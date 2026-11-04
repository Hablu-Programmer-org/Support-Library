/**
 * Creates pending n8n and OpenAI access requests for the owner-supplied list.
 *
 * Dry-run (default): npm run db:bulk-access-requests
 * Apply: npm run db:bulk-access-requests -- --apply --confirm=support_library
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { parseBulkAccessInput, maskEmail } from "../lib/bulk-access-input";
import { getAgentEnrollment } from "../lib/lms";
import { mapLmsRole } from "../lib/lms-roles";
import { N8nAccessRequestModel, UserModel } from "../models";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const RAW_INPUT = String.raw`
tuhin2463@gmail.com
zahidmajumder2@gmail.com
borshon.arafat1@gmail.com
zakirhaque1020@gmail.com
zakirhaque1020@gmail.com
awalunnisa41@gmail.com
abir.hassan4789@gmail.com 
lailanoor285@gmail.com
rayhanjommadder3@gmail.com
rayhanjommadder3@gmail.com
rayhanjommadder3@gmail.com
radhesubhaskaizen@gmail.com
emrulkaishshawon34@gmail.com
sejan715@gmail.com
rokonahmed4543@gmail.com
nurehossainmostakim@gmail.com
naturenoor221@gmail.com
mostakimprodhan00@gmail.com
hellonusratjahan1@gmail.com
tanha2005akter@gmail.com
safwanlabib39@gmail.com
nafiul.shams560@gmail.com
saki_gunsnroses@hotmail.com
likhoneee048@gmail.com
sabujchandraroy79@gmail.com
xunaiet28@gmail.com
mostafa9115015@gmail.com
munaim149@gmail.com
johirulislam8262@gmail.com
sabujmiahllc@gmail.com
sk.imran.basher@gmail.com
uttambiswas5985@gmail.com
alaminsany03@gmail.com
offstaff.ismail@gmail.com
hasan.rahman.raza.2007@gmail.com
ragibishtiyaq007@gmail.com
minhajym123456@gmail.com
mdashifraihan@gmail.com
hmhossain62@gmail.com
mirmoniraahsan43@gmail.com
shahriarmahmud188@gmail.com
MD RAFIUL ISLAM 
ragibishtiyaq007@gmail.com
ragibishtiyaq007@gmail.com
mdrafiulislam1680@gmail.com
shahriarmahmud188@gmail.com
personalgf38@gmail.com
udsdata25@gmail.com
farjanajakir570@gmail.com 
aponafzalhosen@gmail.com
aponafzalhosen@gmail.com
abdulwahedrr@gmail.com
mullah725@gmail.com
muhammadrayhanshuvo@gmail.com
rahmantanjil28@gmail.com
sifat.work8@gmail.com
masumvai25801@gmail.com
Zawad Bin Zahed
photoshopm254@gmail.com
imdadul9439@gmail.com
nusrat14378@gmail.com
slaveknight7000@gmail.com
sfsajidforclash05@gmail.com
rihantalukdar2000@gmail.com 
shamimaru74@gmail.com
jhwafi987@gmail.com
safaislam2269@gmail.com
fatematz302@gmail.com
sajjadhossain472011@gmail.com
rifatrahaman2324@gmail.com
jahanaraaabedin26@gmail.com
sadikaazad03@gmail.com
farjanajakir570@gmail.com
saeidmart@gmail.com
saeidmart@gmail.com
nazmulhossen2051@gmail.com
connect.raza.labs@gmail.com
rakibulhasanhafezmawlana@gmail.com
shaheduli116@gmail.com
mahmudyousuf914@gmail.com
nazirctg2@gmail.com
sheikhthasin0@gmail.com
ashiquzzamansumon7@gmail.com
hasan.rahman.raza.2007@gmail.com
hasan.rahman.raza.2007@gmail.com
jasmin570262@gmail.com
shongkorroy7@gmail.com
shanchowdhary1994@gmail.com
ek78967236@gmail.com
abdulwahedrr@gmail.com
saadshuvo2003@gmail.com
tariqaziz5858@gmail.com
siyatmasfiqhossan@gmail.com 
sijann805@gmail.com
innjewel@gmail.com
jubayerpx24@gmail.com
kanan.ntrack@gmail.com
mdabusayem394@gmail.com
mamunfaruque77@gmail.com 
ashrafulalamreal@gmail.com
Risidul goni
mohiuddintusher18@gmail.com
abidhassanl01608@gmail.com 
contact.nazib@gmail.com
tanbirhasansakib92@gmail.com
fulchand.marine4@gmail.com
coderfirst75@gmail.com
saadshuvo2003@gmail.com
alamgirh0183@gmail.com
jubayeribnsaif98@gmail.com
alif.i.raiyan@gmail.com
connect.raza.labs@gmail.com
ramimislam879@gmail.com
mdshihabkhan7205@gmail.com
ramimislam879@gmail.com
ramimislam879@gmail 
ramimislam879@gmail 
ramimislam879@gmail.com
sarkarsamad046@gmail.com
ramimislam879@gmail.com
fahimfoysalhimel34@gmail.com
nowafmd59@gmail.com
imdadul9439@gmail.com
ripa0656@gmail.com
ftasinrft@gmail.com
dev.dipto100@gmail.com
masumvai25801@gmail.com
aponafzalhosen@gmail.com
aponafzalhosen@gmail.com
marajul.isllam030@gmail.com
joy441529@gmail.com
lailanoor285@gmail.com
shaon555000@gmail.com
mowdud.titu@gmail.com
oshan199301@gmail.com
shuhansh180@gmail.com
alhazxp@gmail.com
slaveknight7000@gmail.com
halder.sristi111@gmail.com
creatorbymofassel@gmail.com
habib56898@gmail.com 
mdmoynulhaque800@gmail.com
urmynatore@gmail.com
mdabdullah018346@gmail.com
abuyusuf019@gmail.com
kingxefad@gmail.com
thinkpadxcarbon11@gmail.com
mdtowhedulislam199@gmail.com
polokmazumder124@gmail.com
sarkermdemon73@gmail.com
goswameepranto@gmail.com
akmolhossain5874@gmail.com

tanbirhasansakib92@gmail.com
mdaalmamun001@gmail.com
motahar1289@gmail.com
mmarzuq2010@gmail.com
htmlmasud34@gmail.com
noushaduddin1998@gmail.com
kazihasibulislam255@gmail.com
mdmoynulhaque800@gmail.com
gonirisidul@gmail.com
mhmahim13119@gmail.com
nadia21jahan@gmail.com
habib56898@gmail.com
nusrat14378@gmail. Com
imdadul9439@gmail.com
aasiabd511@gmail.com
md.shahriarsharafat@gmail.com
safayet.razzak06@gmail.com
mahin 202525@gmail.com
imtiyaznafi7@gmail.com
bhattacharyyaadrita0623@gmail.com
bhattacharyyaadrita0623@gmail.com
Md. Fulchand Molla
motahar1289@gmail.com
ashiquzzamansumon7@gmail.com
taiyabaakhter2728@gmail.com
nafiul.shams560@gmail.com
arifhossencms2008@gmail.com
arifhossencms2008@gmail.com
freelancersohel778@gmail.com
rukutania@gmail.com
sayed897ali@gmail.com
abidarnob11@gmail.com
siamislam141491@gmail.com
aymnsadat@gmail.com
pcdas64@gmail.com
ibnejarir4@gmail.com
arengaronno9@gmail.com
rthafizulhaider@gmail.com
ahmadmusa9805@gmail.com
ullahm@hotmail.com
`;

const REQUEST_TYPES = ["ACCESS", "OPENAI_ACCESS"] as const;
const PURPOSE = "Bulk access request (n8n + OpenAI), 2026-11-03";
const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10);

type LmsUser = {
  _id: mongoose.Types.ObjectId;
  email?: string;
  name?: string;
  image?: string | null;
  role?: string | null;
  isActive?: boolean;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  const supportDbName = process.env.MONGODB_DB?.trim();
  const lmsDbName = process.env.LMS_MONGODB_DB?.trim() || "hp-v2";
  if (!uri) throw new Error("MONGODB_URI is required");
  if (!supportDbName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== supportDbName) {
    throw new Error(`Refusing apply: pass --confirm=${supportDbName} to confirm the target database`);
  }

  const parsed = parseBulkAccessInput(RAW_INPUT);
  console.info(`[bulk-access] mode=${apply ? "APPLY" : "DRY RUN"} database=${supportDbName}`);
  console.info(`[bulk-access] input unique-emails=${parsed.emails.length} names=${parsed.names.length} invalid=${parsed.invalid.length} duplicates=${parsed.duplicateCount}`);
  if (parsed.invalid.length > 0) console.info(`[bulk-access] invalid rows skipped: ${parsed.invalid.join(" | ")}`);

  await mongoose.connect(uri, { dbName: supportDbName, autoIndex: false });
  const supportDb = mongoose.connection.db;
  if (!supportDb) throw new Error("Support database is unavailable");
  const lmsDb = mongoose.connection.getClient().db(lmsDbName);
  const lmsUsers = lmsDb.collection<LmsUser>("User");

  const requestedEmails = new Set(parsed.emails);
  const emailDocs = await lmsUsers.aggregate<LmsUser>([
    { $set: { normalizedEmail: { $toLower: { $trim: { input: { $ifNull: ["$email", ""] } } } } } },
    { $match: { normalizedEmail: { $in: [...requestedEmails] } } },
    { $project: { email: 1, name: 1, image: 1, role: 1, isActive: 1 } },
  ]).toArray();
  const byEmail = new Map(emailDocs.map((user) => [String(user.email).toLowerCase().trim(), user]));

  const resolvedNames: string[] = [];
  const unresolvedNames: string[] = [];
  for (const name of parsed.names) {
    const matches = await lmsUsers.find(
      { name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } },
      { projection: { email: 1, name: 1, image: 1, role: 1, isActive: 1 }, limit: 2 },
    ).toArray();
    if (matches.length !== 1 || !matches[0].email) {
      unresolvedNames.push(name);
      continue;
    }
    const email = matches[0].email.toLowerCase().trim();
    requestedEmails.add(email);
    byEmail.set(email, matches[0]);
    resolvedNames.push(`${name} -> ${maskEmail(email)}`);
  }

  const missing: string[] = [];
  const inactive: string[] = [];
  const nonStudent: string[] = [];
  const eligible: Array<{ email: string; user: LmsUser }> = [];
  for (const email of requestedEmails) {
    const user = byEmail.get(email);
    if (!user) missing.push(email);
    else if (user.isActive === false) inactive.push(email);
    else if (mapLmsRole(user.role) !== "STUDENT") nonStudent.push(email);
    else eligible.push({ email, user });
  }

  console.info(`[bulk-access] names resolved=${resolvedNames.length} unresolved=${unresolvedNames.length}`);
  if (resolvedNames.length > 0) console.info(`[bulk-access] resolved: ${resolvedNames.join(" | ")}`);
  if (unresolvedNames.length > 0) console.info(`[bulk-access] unresolved names skipped: ${unresolvedNames.join(" | ")}`);
  console.info(`[bulk-access] LMS eligible=${eligible.length} missing=${missing.length} inactive=${inactive.length} non-student=${nonStudent.length}`);
  if (missing.length > 0) console.info(`[bulk-access] LMS missing: ${missing.map(maskEmail).join(", ")}`);
  if (inactive.length > 0) console.info(`[bulk-access] inactive: ${inactive.map(maskEmail).join(", ")}`);
  if (nonStudent.length > 0) console.info(`[bulk-access] non-student: ${nonStudent.map(maskEmail).join(", ")}`);

  const indexes = await supportDb.collection("n8n-access-requests").indexes().catch(() => []);
  const hasActiveUniqueIndex = indexes.some((index) => index.name === "n8n-access-requests-student-type-active-unique" && index.unique === true);
  console.info(`[bulk-access] active-request unique index=${hasActiveUniqueIndex ? "present" : "MISSING"}`);
  if (apply && !hasActiveUniqueIndex) {
    throw new Error("Refusing apply: run the approved access-request index migration first");
  }

  const counts = { created: 0, activeSkipped: 0, sentSkipped: 0, failed: 0, agentIneligible: 0 };
  for (const { email, user } of eligible) {
    const agent = await getAgentEnrollment(email);
    if (!agent.enrolled || agent.blocked || agent.batchNo === null) {
      counts.agentIneligible += 1;
      continue;
    }
    try {
      await mongoose.connection.transaction(async (session) => {
        const localUser = await UserModel.findOneAndUpdate(
          { email },
          { $set: { name: user.name?.trim() || email, email, image: user.image || null, role: "STUDENT", isActive: true } },
          { upsert: apply, new: true, runValidators: true, setDefaultsOnInsert: true, session },
        );

        const studentId = localUser?._id;
        const existing = studentId
          ? await N8nAccessRequestModel.find({ studentId, requestType: { $in: REQUEST_TYPES } })
            .select("requestType status").session(session).lean()
          : [];

        for (const requestType of REQUEST_TYPES) {
          const sameType = existing.filter((request) => request.requestType === requestType);
          if (sameType.some((request) => request.status === "PENDING" || request.status === "PROCESSING")) {
            counts.activeSkipped += 1;
            continue;
          }
          if (sameType.some((request) => request.status === "SENT")) {
            counts.sentSkipped += 1;
            continue;
          }
          if (!apply) {
            counts.created += 1;
            continue;
          }

          await N8nAccessRequestModel.updateMany(
            { studentId, requestType, status: "FAILED" },
            { $set: { status: "SUPERSEDED" } },
            { session },
          );
          await N8nAccessRequestModel.create([{
            studentId,
            requestType,
            status: "PENDING",
            purpose: PURPOSE,
            createdBy: null,
            courseSlug: "agent",
            batchNo: agent.batchNo,
            enrollmentId:
              agent.enrollmentId && mongoose.isValidObjectId(agent.enrollmentId)
                ? new mongoose.Types.ObjectId(agent.enrollmentId)
                : null,
          }], { session });
          counts.created += 1;
        }
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        counts.activeSkipped += REQUEST_TYPES.length;
        continue;
      }
      counts.failed += 1;
      console.error(`[bulk-access] failed ${maskEmail(email)}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  console.info(`[bulk-access] summary mode=${apply ? "APPLY" : "DRY RUN"} eligible-students=${eligible.length} requests-created=${counts.created} active-skipped=${counts.activeSkipped} sent-skipped=${counts.sentSkipped} agent-ineligible=${counts.agentIneligible} student-failures=${counts.failed}`);
  if (!apply) console.info(`[bulk-access] dry run only; apply with --apply --confirm=${supportDbName}`);
  if (counts.failed > 0) throw new Error(`${counts.failed} student(s) failed; inspect the masked errors before retrying`);
}

main()
  .catch((error) => {
    console.error("[bulk-access] fatal", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
