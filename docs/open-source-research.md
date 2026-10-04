# Open-Source Research - Support Library

## Scope

Research goal: find open-source projects close to Hablu Programmer's idea of storing daily student support problems, answers, text, files, video links, and reusable solutions.

Research date: 2026-10-04

Method: reviewed public product pages, GitHub README/license pages, and official docs where available. No project was installed or tested locally yet.

## Summary Recommendation

The closest open-source matches are:

1. Frappe Helpdesk
2. Zammad

Both provide ticketing, contact/customer history, agent workflows, and knowledge-base functionality. They can cover much of the support-record and reusable-solution workflow, but Hablu-specific student ID, course, batch, module, lesson, Bangla/Banglish search, and live-support quick entry would still require configuration or customization.

If the goal is fastest production-ready helpdesk behavior, trial Frappe Helpdesk and Zammad first. If the goal is a deeply Hablu-specific support workflow inside the LMS, build a custom Support Library module and use these projects as workflow references.

## Fit Matrix

| Project | License | Best Fit | Main Gap |
|---|---|---|---|
| Frappe Helpdesk | AGPL-3.0 | Ticket + knowledge base + customer portal | Student/course/batch context needs custom fields/workflow |
| Zammad | AGPL-3.0 | Mature helpdesk, custom fields, search, knowledge base | Heavier system; customization required for Hablu-specific quick support flow |
| FreeScout | AGPL-3.0 | Lightweight shared inbox and conversation support | Knowledge base and other features are module-based; workflow is email-centric |
| Chatwoot | MIT core, separate enterprise terms | Live chat, omnichannel inbox, contact history | Stronger for chat operations than structured support library |
| Helpy | MIT core/open-core | Ticket + knowledge base + community Q&A | Older stack/runtime notes; needs deeper maintenance review |
| BookStack | MIT | Documentation and solution library | Not a ticket/support-case system |

## 1. Frappe Helpdesk

Links:

- GitHub: https://github.com/frappe/helpdesk
- Docs: https://docs.frappe.io/helpdesk
- Installation docs: https://docs.frappe.io/helpdesk/installation

### What It Provides

- Ticket creation from email, customer portal, or agent portal.
- Rich-text ticket description.
- Ticket replies with text formatting, images/videos, and attachments according to official ticket-view docs.
- Agent assignment.
- Ticket statuses: open, replied, resolved, closed.
- Internal comments/private notes.
- Contact and customer management.
- Customer portal.
- Knowledge base with draft/public modes.
- Knowledge-base categories and articles.
- Saved replies and support workflows.

### Match With Our Idea

| Our Need | Frappe Helpdesk Fit |
|---|---|
| Student problem record | Ticket |
| Student identity | Contact/customer, but student ID needs custom field |
| Text answer | Ticket reply |
| File attachment | Supported in description/reply editor |
| Video answer | Reply editor docs mention videos/images |
| Follow-up history | Ticket conversation |
| Mentor notes | Private comments |
| Reusable solutions | Knowledge-base article |
| Student self-service | Customer portal |

### Gaps

- Student ID is not a first-class concept.
- Course, batch, module, content, and LMS enrollment context need customization.
- Email is a required contact field in documented contact creation, while our support flow may start with only name/student ID.
- Bangla/Banglish search quality needs hands-on testing.
- Workflow may be more ticketing-oriented than live-support quick logging.

### Initial Verdict

Best open-source candidate for a workflow trial. It is close to the support-case plus knowledge-base model and has documented self-hosting.

## 2. Zammad

Links:

- GitHub: https://github.com/zammad/zammad
- Community/self-hosting: https://zammad.org
- Features: https://zammad.com/en/product/features
- Knowledge base: https://zammad.com/en/product/features/knowledge-base

### What It Provides

- Open-source helpdesk/customer support system.
- Tickets and customer history.
- User/customer information pages.
- Custom fields for tickets, users, and organizations.
- Tags.
- Full-text search.
- File attachments.
- REST API.
- Knowledge base with public, draft, and staff-only visibility.
- Internal linking between tickets and knowledge-base answers.
- Rich text editor and embedded images.

### Match With Our Idea

| Our Need | Zammad Fit |
|---|---|
| Student problem record | Ticket |
| Student identity | User/customer profile + custom fields |
| Course/batch | Ticket custom fields |
| Text answer | Ticket reply/article |
| File answer | Attachment |
| Video link | Knowledge article or ticket reply content |
| Search | Full-text search + tags |
| Reusable solution | Knowledge-base article |
| Internal-only solution | Staff-only article visibility |

### Gaps

- Heavier operational footprint than a small custom support log.
- Need configuration or customization for Hablu-specific LMS concepts.
- Need hands-on test for Bangla/Banglish search.
- Need integration work to link LMS users, courses, and batches.

### Initial Verdict

Strong candidate if we want a mature self-hosted helpdesk. Custom Support Library may still be simpler if the first goal is mentor quick entry and LMS-native context.

## 3. FreeScout

Links:

- Website: https://freescout.net
- GitHub: https://github.com/freescout-helpdesk/freescout
- Knowledge Base module: https://freescout.net/module/knowledge-base

### What It Provides

- Open-source helpdesk and shared mailbox.
- Conversations, internal notes, tags, saved replies, search.
- Omnichannel support via modules.
- Knowledge-base module supports customer self-service or internal agent help center.
- Articles can include images, files, YouTube videos, and embedded iframe videos.

### Gaps

- Many useful capabilities are module-based.
- Knowledge Base is a paid module even though it is open source under AGPL-3.0.
- Email/shared-inbox workflow may not match Zoom/live-support logging directly.
- PHP/Laravel stack differs from Hablu's current backend/frontend stack.

### Initial Verdict

Useful reference for lightweight helpdesk UX. Less attractive than Frappe/Zammad for our first evaluation because knowledge-base capability is module-based.

## 4. Chatwoot

Links:

- GitHub: https://github.com/chatwoot/chatwoot
- Help center: https://www.chatwoot.com/help-center

### What It Provides

- Open-source customer support platform.
- Live chat, email, WhatsApp, Telegram, and other channels.
- Contact management and interaction history.
- Custom attributes for contacts.
- Canned responses.
- Help center portal with articles and FAQs.
- Reports and team workflows.

### Gaps

- Optimized for conversations and omnichannel inbox, not structured support-case archiving.
- Student/course/batch support-library model needs customization.
- More product surface than needed if the first use case is support session logging.

### Initial Verdict

Good if the future goal is web chat and omnichannel student support. Not the closest fit for the current support library idea.

## 5. Helpy

Links:

- GitHub: https://github.com/helpyio/helpy

### What It Provides

- Open-source helpdesk customer support application.
- Ticketing integrated with email.
- Knowledge base.
- Community support forums.
- Searchable articles.
- Mobile-friendly help center.

### Gaps

- README references older Ruby/Rails requirements.
- Open-core model includes paid/pro capabilities.
- Needs deeper maintenance and deployment review before serious consideration.

### Initial Verdict

Good conceptual reference, but not a first-choice candidate without deeper technical due diligence.

## 6. BookStack

Links:

- Website: https://www.bookstackapp.com
- Source: https://codeberg.org/bookstack/bookstack

### What It Provides

- Open-source documentation platform.
- Organizes documentation into books, chapters, and pages.
- Good for internal SOPs and solution articles.
- MIT license.

### Gaps

- Not a ticketing/support-case system.
- Does not naturally track student-specific case history.
- Would need a separate support log database.

### Initial Verdict

Useful if we only need a solution-library/wiki. Not enough for the full student support record system.

## License Notes

- The Support-Library repo currently uses MIT.
- Frappe Helpdesk, Zammad, and FreeScout are AGPL-3.0 projects. Forking/copying their code into this project would require careful license compliance and cannot simply remain MIT-only.
- Chatwoot's core is MIT, but the repository notes separate terms for enterprise code.
- Using workflow ideas, product patterns, and public documentation as inspiration is different from copying source code.

## Trial Checklist

Before deciding to build custom, run this checklist against Frappe Helpdesk and Zammad.

- Can a mentor create a case within one minute during live support?
- Can a case be created with only student ID/name if email is unavailable?
- Can we add custom fields for student ID, course, batch, module, content, and support shift?
- Can one answer include text, files, screenshots, and video links?
- Can mentors add internal notes invisible to students?
- Can a reusable solution article be linked back to a support case?
- Can a support case link to multiple solution articles?
- Can search find Bangla, English, and Banglish problem descriptions?
- Can selected solution articles stay internal while others become public?
- Can we integrate LMS user/course/batch data through API or custom fields?

## Build vs Adopt

### Adopt or Customize Open Source If

- We need ticketing, customer portal, agent assignment, email, and SLA quickly.
- We are comfortable running a separate helpdesk application.
- We can accept the project's license and operational stack.
- Hablu-specific LMS integration can be phase two.

### Build Custom If

- The first priority is live Zoom support logging, not a full ticketing suite.
- The system must be tightly connected with Hablu LMS student/course/batch data.
- The team needs a Bangla-first minimal UI.
- We want complete control over file/video linking, search, and future AI features.

## Working Recommendation

Do not commit to a full custom build before a short trial. First, collect 100-200 real support records using a simple structured format or a configured helpdesk trial. Then finalize whether to:

1. Customize Frappe Helpdesk.
2. Customize Zammad.
3. Build a Hablu-native Support Library.

For the current product direction, the safest MVP plan is a staff-first support log plus reusable solution library, with student self-service and AI deferred.
