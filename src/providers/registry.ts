import type { GatewayConfig, ProviderConfig, ProviderId } from "../types.js";
import { GenericFrontendProvider } from "./generic-provider.js";

export class ProviderRegistry {
  private readonly providers: Record<ProviderId, GenericFrontendProvider>;

  constructor(providerConfigs: Record<ProviderId, ProviderConfig>, gatewayConfig: GatewayConfig) {
    this.providers = {
      chatgpt: new GenericFrontendProvider(providerConfigs.chatgpt, gatewayConfig),
      claude: new GenericFrontendProvider(providerConfigs.claude, gatewayConfig),
      gemini: new GenericFrontendProvider(providerConfigs.gemini, gatewayConfig),
      grok: new GenericFrontendProvider(providerConfigs.grok, gatewayConfig),
    };
  }

  get(providerId: ProviderId): GenericFrontendProvider {
    return this.providers[providerId];
  }

  list(): GenericFrontendProvider[] {
    return Object.values(this.providers);
  }
}
