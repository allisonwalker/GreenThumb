import { and, asc, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";

export type ConversationKind = "ask" | "time_budget";
export type MessageRole = "user" | "assistant";

export type ConversationRecord = {
  id: string;
  userId: string;
  kind: ConversationKind;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agentRunId: string | null;
  createdAt: Date;
};

export type ConversationStore = {
  getOrCreate(
    userId: string,
    kind: ConversationKind,
  ): Promise<ConversationRecord>;
  listMessages(conversationId: string): Promise<MessageRecord[]>;
  appendMessage(input: {
    conversationId: string;
    role: MessageRole;
    content: string;
    agentRunId?: string | null;
  }): Promise<MessageRecord>;
  clearMessages(userId: string, kind: ConversationKind): Promise<void>;
};

export function createConversationStore(): ConversationStore {
  async function getOrCreate(
    userId: string,
    kind: ConversationKind,
  ): Promise<ConversationRecord> {
    const database = getDatabase();
    const existing = await database
      .select({
        id: conversations.id,
        userId: conversations.userId,
        kind: conversations.kind,
      })
      .from(conversations)
      .where(
        and(eq(conversations.userId, userId), eq(conversations.kind, kind)),
      )
      .limit(1);

    const found = existing[0];
    if (found) {
      return found;
    }

    await database
      .insert(conversations)
      .values({ userId, kind })
      .onConflictDoNothing({
        target: [conversations.userId, conversations.kind],
      });

    const created = await database
      .select({
        id: conversations.id,
        userId: conversations.userId,
        kind: conversations.kind,
      })
      .from(conversations)
      .where(
        and(eq(conversations.userId, userId), eq(conversations.kind, kind)),
      )
      .limit(1);
    const row = created[0];
    if (!row) {
      throw new Error("Failed to create conversation");
    }
    return row;
  }

  return {
    getOrCreate,

    async listMessages(conversationId) {
      const database = getDatabase();
      return database
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          role: messages.role,
          content: messages.content,
          agentRunId: messages.agentRunId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt));
    },

    async appendMessage(input) {
      const database = getDatabase();
      const inserted = await database
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          agentRunId: input.agentRunId ?? null,
        })
        .returning({
          id: messages.id,
          conversationId: messages.conversationId,
          role: messages.role,
          content: messages.content,
          agentRunId: messages.agentRunId,
          createdAt: messages.createdAt,
        });
      const row = inserted[0];
      if (!row) {
        throw new Error("Failed to append message");
      }

      await database
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId));

      return row;
    },

    async clearMessages(userId, kind) {
      const conversation = await getOrCreate(userId, kind);
      const database = getDatabase();
      await database
        .delete(messages)
        .where(eq(messages.conversationId, conversation.id));
      await database
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));
    },
  };
}
