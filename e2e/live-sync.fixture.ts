import { test as base, expect } from "@playwright/test";
import {
  createLiveSupabaseUser,
  deleteLiveSupabaseUser,
  type LiveSupabaseTestUser,
} from "./liveSupabaseAdmin";

interface LiveSyncFixtures {
  liveUser: LiveSupabaseTestUser;
}

export const test = base.extend<LiveSyncFixtures>({
  liveUser: async ({}, use) => {
    const user = await createLiveSupabaseUser();
    try {
      await use(user);
    } finally {
      await deleteLiveSupabaseUser(user.id);
    }
  },
});

export { expect };
