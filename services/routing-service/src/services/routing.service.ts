import { eq } from 'drizzle-orm';
import { getDb, routingProfiles, bankLinks } from '@rald-alia/db';
import { generateId, NotFoundError } from '@rald-alia/shared';

export class RoutingService {
  private db = getDb();

  async getProfile(userId: string) {
    const [profile] = await this.db
      .select()
      .from(routingProfiles)
      .where(eq(routingProfiles.userId, userId))
      .limit(1);

    if (!profile) throw new NotFoundError('RoutingProfile', userId);
    return profile;
  }

  async upsertProfile(userId: string, data: {
    primaryBankCode: string;
    fallbackBankCode?: string;
    routingRules?: Record<string, unknown>;
  }) {
    const existing = await this.db
      .select()
      .from(routingProfiles)
      .where(eq(routingProfiles.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(routingProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(routingProfiles.userId, userId))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(routingProfiles)
      .values({ id: generateId('rtp'), userId, ...data })
      .returning();

    return created;
  }

  async determineRoute(userId: string, _amount: number) {
    const [profile] = await this.db
      .select()
      .from(routingProfiles)
      .where(eq(routingProfiles.userId, userId))
      .limit(1);

    if (profile) {
      return {
        destinationBankCode: profile.primaryBankCode,
        fallbackBankCode: profile.fallbackBankCode,
        routingStrategy: 'profile',
      };
    }

    const [primaryLink] = await this.db
      .select()
      .from(bankLinks)
      .where(eq(bankLinks.userId, userId))
      .limit(1);

    if (primaryLink) {
      return {
        destinationBankCode: primaryLink.bankCode,
        fallbackBankCode: null,
        routingStrategy: 'bank_link',
      };
    }

    throw new NotFoundError('RoutingProfile', userId);
  }
}
