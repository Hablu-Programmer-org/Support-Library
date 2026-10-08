import { dbConnect } from "../lib/db";
import {
  CaseSolutionLinkModel,
  SolutionArticleModel,
  SupportCaseModel,
  SupportReplyModel,
  UserModel,
} from "../models";

const models = [
  UserModel,
  SupportCaseModel,
  SupportReplyModel,
  SolutionArticleModel,
  CaseSolutionLinkModel,
];

async function main() {
  await dbConnect();

  for (const model of models) {
    const result = await model.syncIndexes();
    console.info(`[db:indexes] ${model.modelName}`, result);
  }

  await process.exit(0);
}

main().catch((error) => {
  console.error("[db:indexes] failed", error);
  process.exit(1);
});
