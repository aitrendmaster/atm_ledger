/**
 * Moa AI 가계부 운영 주체 정보.
 *
 * 약관 / 개인정보처리방침 / 푸터 / 결제 페이지 등에서 일관되게 참조.
 * 값 변경 시 이 파일만 수정하면 전 앱에 반영됨.
 *
 * 출처: ㈜에이티엠스토어 사업자등록증, 통신판매업 신고증.
 */

export const COMPANY = {
  legalNameKo: '주식회사 에이티엠스토어',
  legalNameEn: 'ATM Store Co., Ltd.',
  shortNameKo: '㈜에이티엠스토어',
  serviceName: 'Moa AI 가계부',
  ceo: '오유진',
  businessRegistrationNumber: '396-21-02113',
  mailOrderRegistrationNumber: '2025-부천소사-0174',
  /** 사업장 도로명 주소 (사업자등록증 기준) */
  addressKo: '경기도 부천시 소사로 257길 6층 C14',
  addressEn: 'C14, 6F, 257-gil Sosa-ro, Bucheon-si, Gyeonggi-do, Republic of Korea',
  supportEmail: 'master@aitrend.kr',
  privacyOfficerName: '오유진',
  privacyOfficerEmail: 'master@aitrend.kr',
  /** 약관 시행일 (yyyy-mm-dd) */
  termsEffectiveDate: '2026-05-21',
  /** 처리방침 시행일 */
  privacyEffectiveDate: '2026-05-21',
} as const

export type Company = typeof COMPANY
