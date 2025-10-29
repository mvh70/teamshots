export interface MetricOptions {
  tags?: Record<string, string>
}

export const Telemetry = {
  // Placeholder no-op metrics; wire to a provider as needed
  increment: (name: string, value = 1, _opts?: MetricOptions) => {
    void name; void value; void _opts
  },
  timing: (name: string, ms: number, _opts?: MetricOptions) => {
    void name; void ms; void _opts
  },
}


