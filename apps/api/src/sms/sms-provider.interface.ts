/** One interface for every SMS gateway. Queue logic never sees a gateway. */
export interface SmsSendResult {
  providerMsgId?: string;
  costBdt: number;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string, opts: { masking: boolean }): Promise<SmsSendResult>;
  balance(): Promise<number | null>;
}
