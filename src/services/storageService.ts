/**
 * Storage Service for Multi-Profiles (3 Default Profiles), Google Auth, and Daily Progress Logs
 * - 도메인 연산(Voiceprint/NoteScoreStat)은 src/core/scoring/voiceprintAnalyzer.ts로 분리하여 단일 책임 원칙(SRP) 준수
 */
import { midiToFrequency } from '../core/music/pitchUtils';
import {
  DEFAULT_VOICEPRINT,
  updateProfileWithNoteScoreAndVoiceprint,
} from '../core/scoring/voiceprintAnalyzer';
import {
  GoogleAuthUser,
  TrainingRecord,
  UserVocalProfile,
} from '../types/vocal';

export { DEFAULT_VOICEPRINT, updateProfileWithNoteScoreAndVoiceprint };

const PROFILES_LIST_KEY = 'singsharp_vocal_profiles_v2';
const ACTIVE_PROFILE_ID_KEY = 'singsharp_active_profile_id_v2';
const LEGACY_PROFILE_KEY = 'singsharp_vocal_profile_v1';
const RECORDS_STORAGE_KEY = 'singsharp_daily_records_v1';
const GOOGLE_AUTH_KEY = 'singsharp_google_auth_v1';

export function createDefaultProfile(id: string, name: string, centerMidi = 55): UserVocalProfile {
  return {
    id,
    name,
    lowestMidi: centerMidi - 7,
    highestMidi: centerMidi + 9,
    comfortableCenterMidi: centerMidi,
    customOctaveSpan: 2,
    customBaseMidi: Math.max(40, centerMidi - 7),
    lastTestedAt: null,
    micNoiseFloor: 8,
    micNormalLevel: 65,
    bassClefThresholdMidi: 59,
    defaultDemoDurationSec: 1.5,
    masterVolume: 75,
    noteScoreStats: {},
    voiceprint: {
      ...DEFAULT_VOICEPRINT,
      fundamentalFreqHz: Math.round(midiToFrequency(centerMidi) * 10) / 10,
    },
  };
}

export const DEFAULT_PROFILES: UserVocalProfile[] = [
  createDefaultProfile('profile-1', '프로파일 1', 53), // F3
  createDefaultProfile('profile-2', '프로파일 2', 60), // C4
  createDefaultProfile('profile-3', '프로파일 3', 48), // C3
];

export const DEFAULT_VOCAL_PROFILE: UserVocalProfile = DEFAULT_PROFILES[0];

export function loadAllProfiles(): UserVocalProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserVocalProfile>[];
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3).map((p, idx) => {
          const fallback = DEFAULT_PROFILES[idx];
          return {
            ...fallback,
            ...p,
            id: fallback.id,
            name: p.name?.trim() ? p.name : fallback.name,
            noteScoreStats: p.noteScoreStats ?? {},
            voiceprint: { ...DEFAULT_VOICEPRINT, ...(p.voiceprint ?? {}) },
          };
        });
      }
    }

    // 기존 단일 프로파일 데이터가 있으면 프로파일 1로 마이그레이션
    const legacyRaw = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<UserVocalProfile>;
      const migratedFirst: UserVocalProfile = {
        ...DEFAULT_PROFILES[0],
        ...legacy,
        id: 'profile-1',
        name: legacy.name?.trim() || '프로파일 1',
        noteScoreStats: legacy.noteScoreStats ?? {},
        voiceprint: { ...DEFAULT_VOICEPRINT, ...(legacy.voiceprint ?? {}) },
      };
      const initialList = [migratedFirst, DEFAULT_PROFILES[1], DEFAULT_PROFILES[2]];
      saveAllProfiles(initialList);
      return initialList;
    }

    saveAllProfiles(DEFAULT_PROFILES);
    return DEFAULT_PROFILES;
  } catch {
    return DEFAULT_PROFILES;
  }
}

export function saveAllProfiles(profiles: UserVocalProfile[]): void {
  try {
    localStorage.setItem(PROFILES_LIST_KEY, JSON.stringify(profiles));
  } catch {
    // 스토리지 제한 무시
  }
}

export function loadActiveProfileId(): string {
  try {
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    if (saved && ['profile-1', 'profile-2', 'profile-3'].includes(saved)) {
      return saved;
    }
    return 'profile-1';
  } catch {
    return 'profile-1';
  }
}

export function saveActiveProfileId(profileId: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, profileId);
  } catch {
    // 스토리지 제한 무시
  }
}

export function loadVocalProfile(): UserVocalProfile {
  const profiles = loadAllProfiles();
  const activeId = loadActiveProfileId();
  return profiles.find((p) => p.id === activeId) ?? profiles[0];
}

export function saveVocalProfile(profile: UserVocalProfile): UserVocalProfile[] {
  const profiles = loadAllProfiles();
  const updated = profiles.map((p) => (p.id === profile.id ? profile : p));
  saveAllProfiles(updated);
  return updated;
}

export function loadTrainingRecords(): TrainingRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrainingRecord[];
  } catch {
    return [];
  }
}

export function saveTrainingRecord(record: TrainingRecord): TrainingRecord[] {
  const existing = loadTrainingRecords();
  const updated = [record, ...existing].slice(0, 300);
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // 스토리지 제한 무시
  }
  return updated;
}

export function clearAllTrainingRecords(): void {
  localStorage.removeItem(RECORDS_STORAGE_KEY);
}

export const DEFAULT_GOOGLE_AUTH: GoogleAuthUser = {
  isLoggedIn: false,
  displayName: '',
  email: '',
  lastSyncedAt: null,
};

export function loadGoogleAuthUser(): GoogleAuthUser {
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_KEY);
    if (!raw) return DEFAULT_GOOGLE_AUTH;
    return { ...DEFAULT_GOOGLE_AUTH, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GOOGLE_AUTH;
  }
}

export function saveGoogleAuthUser(user: GoogleAuthUser): void {
  try {
    localStorage.setItem(GOOGLE_AUTH_KEY, JSON.stringify(user));
  } catch {
    // 스토리지 제한 무시
  }
}
