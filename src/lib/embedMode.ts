/**
 * Embedded mode detection for sub2api 集成场景。
 *
 * 触发方式：宿主页通过 iframe 加载时在 URL 上带 `?ui_mode=embedded`。
 * 第一次检测到就写入 sessionStorage，之后即便宿主侧（或本应用自身）清掉
 * 查询参数，刷新或路由跳转后仍能保持嵌入模式。
 */

const STORAGE_KEY = 'gpt_image_playground:embedded'
const URL_PARAM_KEY = 'ui_mode'
const URL_PARAM_VALUE = 'embedded'

let cached: boolean | null = null

export function isEmbeddedMode(): boolean {
  if (cached !== null) return cached
  if (typeof window === 'undefined') {
    cached = false
    return cached
  }

  try {
    if (window.sessionStorage.getItem(STORAGE_KEY) === '1') {
      cached = true
      return cached
    }
  } catch {
    // sessionStorage 不可用（隐私模式/沙箱），降级到只看当前 URL
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get(URL_PARAM_KEY) === URL_PARAM_VALUE) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    cached = true
    return cached
  }

  cached = false
  return cached
}
