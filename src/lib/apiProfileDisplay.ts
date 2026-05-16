import type { TaskRecord } from '../types'

export const URL_PARAM_PROFILE_NAME = '默认配置'

const LEGACY_URL_PARAM_PROFILE_NAME = 'URL 参数配置'
const URL_PARAM_PROFILE_ID_PREFIX = 'openai-url-'

export function isUrlParamProfileReference(profileId?: string | null, profileName?: string | null) {
  return Boolean(
    profileId?.startsWith(URL_PARAM_PROFILE_ID_PREFIX) ||
    profileName?.trim() === LEGACY_URL_PARAM_PROFILE_NAME,
  )
}

export function getTaskProfileDisplayName(task: Pick<TaskRecord, 'apiProfileId' | 'apiProfileName'>) {
  const name = task.apiProfileName?.trim()
  if (!name || isUrlParamProfileReference(task.apiProfileId, name)) return null
  return name
}
