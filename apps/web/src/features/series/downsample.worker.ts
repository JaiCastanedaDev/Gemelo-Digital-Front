import { handleDownsample, type DownsampleRequest } from './downsampleTask';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DownsampleRequest>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = (event) => {
  scope.postMessage(handleDownsample(event.data));
};
