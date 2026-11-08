/**
 * SingSharp Dual Versioning & Cache-Busting Configuration
 * - APP_VERSION: 정식 시맨틱 버전 (SemVer, 사용자 승인 시에만 변경)
 * - BUILD_TAG: 일자 기반 캐시 버스팅 태그 (YYYYMMDDvN, 코드 업데이트 시 자동 갱신)
 */
export const APP_VERSION = '0.1.0';
export const BUILD_TAG = '20261109v1';
export const FULL_VERSION_STRING = `v${APP_VERSION} (${BUILD_TAG})`;
