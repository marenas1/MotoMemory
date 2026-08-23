import type {
  AnswerProvider,
  AnswerProviderInput,
  AnswerProviderResult,
} from "@/lib/manual/manual-answering";

export class MockAnswerProvider implements AnswerProvider {
  readonly name = "mock";
  readonly inputs: AnswerProviderInput[] = [];

  constructor(
    private readonly responder: (
      input: AnswerProviderInput,
    ) => AnswerProviderResult | Promise<AnswerProviderResult>,
  ) {}

  answer(input: AnswerProviderInput): Promise<AnswerProviderResult> {
    this.inputs.push(input);
    return Promise.resolve(this.responder(input));
  }
}
