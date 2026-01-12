/**
 * Extension Domain
 *
 * Handles Chrome extension authentication and operations
 */

export {
  createExtensionToken,
  validateExtensionToken,
  revokeExtensionToken,
  listExtensionTokens,
  getExtensionAuthFromHeaders,
  EXTENSION_SCOPES,
  type ExtensionScope,
  type ExtensionTokenPayload,
  type CreateTokenResult,
  type CreateTokenError,
  type ValidateTokenResult,
  type ValidateTokenError,
} from './auth'
