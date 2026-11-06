import React, { useState } from 'react';
import styles from '../../App.module.css';
import { toneSynth } from '../../core/audio/toneSynth';
import { midiToNoteName } from '../../core/music/pitchUtils';
import { TRAINING_MODES } from '../../core/music/sequenceGenerator';
import {
  GoogleAuthUser,
  TrainingMode,
  UserVocalProfile,
} from '../../types/vocal';
import { APP_VERSION, BUILD_TAG, FULL_VERSION_STRING } from '../../version';

export type MainMenuId =
  | 'range_test'
  | 'training'
  | 'cert_test'
  | 'progress'
  | 'voiceprint'
  | 'settings';

interface SidebarDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  activeMenu: MainMenuId;
  onSelectMenu: (menu: MainMenuId) => void;
  selectedTrainingMode: TrainingMode;
  onSelectTrainingMode: (mode: TrainingMode) => void;
  profiles: UserVocalProfile[];
  activeProfile: UserVocalProfile;
  onSelectProfile: (id: string) => void;
  onRenameProfile: (id: string, newName: string) => void;
  recordCount: number;
  googleUser: GoogleAuthUser;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onToggleOpen,
  onClose,
  activeMenu,
  onSelectMenu,
  selectedTrainingMode,
  onSelectTrainingMode,
  profiles,
  activeProfile,
  onSelectProfile,
  onRenameProfile,
  recordCount,
  googleUser,
  onGoogleLogin,
  onGoogleLogout,
}) => {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingNameDraft, setEditingNameDraft] = useState<string>('');

  const handleStartRename = (target: UserVocalProfile) => {
    setEditingProfileId(target.id);
    setEditingNameDraft(target.name);
  };

  const handleCommitRename = (id: string) => {
    const trimmed = editingNameDraft.trim();
    if (trimmed) {
      onRenameProfile(id, trimmed);
    }
    setEditingProfileId(null);
  };

  const profileNoteStatCount = Object.keys(activeProfile.noteScoreStats ?? {}).length;

  return (
    <>
      {/* 좌측 상단에 float 되어 있는 사이트 아이콘(♪) 버튼 */}
      <button
        type="button"
        className={`${styles.floatingSiteIconBtn} ${
          isOpen ? styles.floatingSiteIconBtnActive : ''
        }`}
        onClick={onToggleOpen}
        title={isOpen ? '사이드바 숨기기' : '사이드바 메뉴 열기'}
        aria-label="사이트 아이콘 사이드바 토글"
      >
        ♪
      </button>

      {/* 사이드바 배경 오버레이 */}
      {isOpen && (
        <div
          className={styles.sidebarBackdrop}
          onClick={onClose}
        />
      )}

      {/* 왼쪽에서 오른쪽으로 확장되는 슬라이딩 사이드바 */}
      <aside
        className={`${styles.sidebarDrawer} ${
          isOpen ? styles.sidebarDrawerOpen : ''
        }`}
      >
        <div className={styles.sidebarNavWrap}>
          <div className={styles.sidebarSectionLabel}>
            MENU · {activeProfile.name}
          </div>

          <nav className={styles.menuList}>
            {/* 1. 테스트 (음역대 측정) */}
            <button
              type="button"
              className={`${styles.menuItem} ${
                activeMenu === 'range_test' ? styles.menuItemActive : ''
              }`}
              onClick={() => onSelectMenu('range_test')}
            >
              <span>🎚️ 테스트 (음역대 측정)</span>
            </button>

            {/* 2. 트레이닝 + 5대 훈련 서브메뉴 */}
            <div className={styles.menuGroup}>
              <button
                type="button"
                className={`${styles.menuItem} ${
                  activeMenu === 'training' ? styles.menuItemActive : ''
                }`}
                onClick={() => onSelectMenu('training')}
              >
                <span>🎤 트레이닝</span>
                <span className={styles.subCountBadge}>5종</span>
              </button>

              <div className={styles.subMenuList}>
                {TRAINING_MODES.map((m) => {
                  const isSubActive =
                    activeMenu === 'training' && selectedTrainingMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`${styles.subMenuItem} ${
                        isSubActive ? styles.subMenuItemActive : ''
                      }`}
                      onClick={() => {
                        toneSynth.stopAll();
                        onSelectMenu('training');
                        onSelectTrainingMode(m.id);
                      }}
                    >
                      <span
                        className={styles.subDot}
                        style={{ backgroundColor: m.badgeColor }}
                      />
                      <span>{m.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 테스트(점수인증) */}
            <button
              type="button"
              className={`${styles.menuItem} ${
                activeMenu === 'cert_test' ? styles.menuItemActive : ''
              }`}
              onClick={() => onSelectMenu('cert_test')}
            >
              <span>🏆 테스트(점수인증)</span>
            </button>

            {/* 4. 성과기록 */}
            <button
              type="button"
              className={`${styles.menuItem} ${
                activeMenu === 'progress' ? styles.menuItemActive : ''
              }`}
              onClick={() => onSelectMenu('progress')}
            >
              <span>📊 성과기록</span>
              <span className={styles.recordCountPill}>{recordCount}</span>
            </button>

            {/* 5. 음성지문 (성과기록 메뉴 바로 밑에 추가) */}
            <button
              type="button"
              className={`${styles.menuItem} ${
                activeMenu === 'voiceprint' ? styles.menuItemActive : ''
              }`}
              onClick={() => onSelectMenu('voiceprint')}
            >
              <span>🔍 음성지문</span>
              <span className={styles.recordCountPill}>{profileNoteStatCount}음</span>
            </button>
          </nav>
        </div>

        {/* 사이드바 하단 영역: [프로파일 (기본 3개, 이름변경)] -> [구글 로그인] -> [⚙️ 세팅] -> 브랜드 푸터 */}
        <div className={styles.sidebarBottomSection}>
          {/* 1) 로그인 위에 프로파일 (기본 3개 제공 + 이름 변경 가능) */}
          <div className={styles.profileBox}>
            <div className={styles.profileBoxHeader}>
              <span>👤 프로파일 (기본 3개)</span>
              <span>✏️ 이름변경</span>
            </div>
            <div className={styles.profileList}>
              {profiles.map((p) => {
                const isSelected = p.id === activeProfile.id;
                const isEditing = editingProfileId === p.id;
                return (
                  <div key={p.id} className={styles.profileItemRow}>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          className={styles.profileRenameInput}
                          value={editingNameDraft}
                          onChange={(e) => setEditingNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitRename(p.id);
                            if (e.key === 'Escape') setEditingProfileId(null);
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.profileRenameBtn}
                          onClick={() => handleCommitRename(p.id)}
                          title="이름 저장"
                        >
                          ✔
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`${styles.profileSelectBtn} ${
                            isSelected ? styles.profileSelectBtnActive : ''
                          }`}
                          onClick={() => onSelectProfile(p.id)}
                        >
                          <span>{p.name}</span>
                          <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                            {p.lastTestedAt
                              ? `${midiToNoteName(p.lowestMidi)}~${midiToNoteName(
                                  p.highestMidi
                                )}`
                              : `기준 ${midiToNoteName(p.comfortableCenterMidi)}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.profileRenameBtn}
                          onClick={() => handleStartRename(p)}
                          title={`${p.name} 이름 변경`}
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2) 세팅 위에 구글 로그인 */}
          {googleUser.isLoggedIn ? (
            <div className={styles.googleLoggedInBox}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, color: '#3fb950' }}>
                  G {googleUser.displayName}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#8b949e' }}>
                  {googleUser.email}
                </div>
              </div>
              <button
                type="button"
                className={styles.googleLogoutBtn}
                onClick={onGoogleLogout}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.googleLoginBtn}
              onClick={onGoogleLogin}
            >
              <span>🔵 Google 계정으로 로그인</span>
              <span style={{ fontSize: '0.72rem', color: '#57606a' }}>동기화</span>
            </button>
          )}

          {/* 3) 세팅 (Settings) */}
          <button
            type="button"
            className={`${styles.menuItem} ${styles.settingsMenuItem} ${
              activeMenu === 'settings' ? styles.menuItemActive : ''
            }`}
            onClick={() => onSelectMenu('settings')}
          >
            <span>⚙️ 세팅 (Settings)</span>
          </button>

          {/* 4) 최하단 어플 아이콘, 제목, 버전 */}
          <div className={styles.sidebarFooterBrand}>
            <div className={styles.logoBadge}>♪</div>
            <div className={styles.brandMeta}>
              <div className={styles.appTitle}>SingSharp</div>
              <div className={styles.versionText}>{FULL_VERSION_STRING}</div>
              <div className={styles.versionSub}>
                Release v{APP_VERSION} · {BUILD_TAG}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
