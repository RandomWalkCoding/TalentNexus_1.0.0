import type { z } from "zod";
import type { mailExclusionReasonSchema, mailProjectStageChangeSchema } from "@hr-console/contracts";
export type { MailMessageDetail, MailReplyDetail, MailDraftCreate, MailProvider } from "@hr-console/contracts";
export type MailExclusionReasonSchema = z.infer<typeof mailExclusionReasonSchema>;
export type MailProjectStageChangeSchema = z.infer<typeof mailProjectStageChangeSchema>;
