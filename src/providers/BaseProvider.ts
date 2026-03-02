export abstract class BaseProvider {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
