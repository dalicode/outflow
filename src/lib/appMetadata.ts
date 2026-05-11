export const appVersion =
  import.meta.env.VITE_APP_VERSION || 'dev'

export const appBuildSha =
  import.meta.env.VITE_APP_BUILD_SHA || 'local'

export const appBuildDate =
  import.meta.env.VITE_APP_BUILD_DATE || ''

export const appEnvironment =
  import.meta.env.VITE_APP_ENV || 'local'

export const shortBuildSha =
  appBuildSha && appBuildSha !== 'local'
    ? appBuildSha.slice(0, 7)
    : appBuildSha

export function getAppDiagnostics(): Record<string, string> {
  return {
    Version: appVersion,
    'Build SHA': appBuildSha,
    Environment: appEnvironment,
    'Build date': appBuildDate,
    'User agent': typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  }
}
