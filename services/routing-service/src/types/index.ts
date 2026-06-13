export interface RouteDecision {
  destinationBankCode: string;
  fallbackBankCode?: string | null;
  routingStrategy: 'profile' | 'bank_link' | 'default';
}
