import React, { useEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import { DailyProgress } from './components/DailyProgress/DailyProgress';
import { SettingsView } from './components/SettingsView/SettingsView';
import { MainMenuId, SidebarDrawer } from './components/SidebarDrawer/SidebarDrawer';
import { TrainingStudio } from './components/TrainingStudio/TrainingStudio';
import { VocalRangeTest } from './components/VocalRangeTest/VocalRangeTest';
import { VoiceprintView } from './components/VoiceprintView/VoiceprintView';
import { toneSynth } from './core/audio/toneSynth';
import { DIFFICULTY_LEVELS } from './core/music/sequenceGenerator';
import { microphoneService } from './services/microphoneService';
import {
  clearAllTrainingRecords,
  DEFAULT_GOOGLE_AUTH,
  loadActiveProfileId,
  loadAllProfiles,
  loadGoogleAuthUser,
  loadTrainingRecords,
  saveActiveProfileId,
  saveAllProfiles,
  saveGoogleAuthUser,
  saveTrainingRecord,
  saveVocalProfile,
} from './services/storageService';
import {
  DifficultyLevel,
  GoogleAuthUser,
  TrainingMode,
  TrainingRecord,
  UserVocalProfile,
} from './types/vocal';

export const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<MainMenuId>('training');
  const [selectedTrainingMode, setSelectedTrainingMode] =
    useState<TrainingMode>('pitch_accuracy');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(1);

  const [profiles, setProfiles] = useState<UserVocalProfile[]>(() => loadAllProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    loadActiveProfileId()
  );

  const [googleUser, setGoogleUser] = useState<GoogleAuthUser>(() =>
    loadGoogleAuthUser()
  );
  const [records, setRecords] = useState<TrainingRecord[]>(() => loadTrainingRecords());

  const [isSimMode, setIsSimMode] = useState<boolean>(false);
  const [simCentsOffset, setSimCentsOffset] = useState<number>(0);
  const [simVolume, setSimVolume] = useState<number>(68);

  const profile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  useEffect(() => {
    toneSynth.setMasterVolume(profile.masterVolume ?? 75);
  }, [profile.masterVolume, profile.id]);

  const tabRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (activeMenu === 'training') {
      const activeBtn = tabRefs.current[selectedDifficulty];
      if (activeBtn) {
        activeBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [selectedDifficulty, activeMenu]);

  const handleSelectProfile = (id: string) => {
    toneSynth.stopAll();
    setActiveProfileId(id);
    saveActiveProfileId(id);
  };

  const handleUpdateProfile = (next: UserVocalProfile) => {
    const updatedList = saveVocalProfile(next);
    setProfiles(updatedList);
  };

  const handleRenameProfile = (id: string, newName: string) => {
    const nextList = profiles.map((p) =>
      p.id === id ? { ...p, name: newName } : p
    );
    setProfiles(nextList);
    saveAllProfiles(nextList);
  };

  const handleGoogleLogin = () => {
    const nextUser: GoogleAuthUser = {
      isLoggedIn: true,
      displayName: `${profile.name} 사용자`,
      email: 'vocal.user@gmail.com',
      lastSyncedAt: new Date().toISOString(),
    };
    setGoogleUser(nextUser);
    saveGoogleAuthUser(nextUser);
  };

  const handleGoogleLogout = () => {
    setGoogleUser(DEFAULT_GOOGLE_AUTH);
    saveGoogleAuthUser(DEFAULT_GOOGLE_AUTH);
  };

  const handleSaveRecord = (rec: TrainingRecord) => {
    const updated = saveTrainingRecord(rec);
    setRecords(updated);
  };

  const handleClearRecords = () => {
    clearAllTrainingRecords();
    setRecords([]);
  };

  const toggleInputMode = async (enableSim: boolean) => {
    setIsSimMode(enableSim);
    if (enableSim) {
      microphoneService.startSimulator(440);
    } else {
      microphoneService.stop();
    }
  };

  const handleSelectMenu = (menu: MainMenuId) => {
    toneSynth.stopAll();
    setActiveMenu(menu);
  };

  return (
    <div className={styles.appContainer}>
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen((prev) => !prev)}
        onClose={() => setIsSidebarOpen(false)}
        activeMenu={activeMenu}
        onSelectMenu={handleSelectMenu}
        selectedTrainingMode={selectedTrainingMode}
        onSelectTrainingMode={setSelectedTrainingMode}
        profiles={profiles}
        activeProfile={profile}
        onSelectProfile={handleSelectProfile}
        onRenameProfile={handleRenameProfile}
        recordCount={records.length}
        googleUser={googleUser}
        onGoogleLogin={handleGoogleLogin}
        onGoogleLogout={handleGoogleLogout}
      />

      <main className={styles.mainContent}>
        {activeMenu === 'training' && (
          <nav className={styles.folderTabStrip} aria-label="트레이닝 난이도 파일철 탭">
            {DIFFICULTY_LEVELS.map((d) => {
              const isActive = selectedDifficulty === d.level;
              return (
                <button
                  key={d.level}
                  ref={(el) => {
                    tabRefs.current[d.level] = el;
                  }}
                  type="button"
                  className={`${styles.folderTab} ${
                    isActive ? styles.folderTabActive : ''
                  }`}
                  onClick={() => {
                    toneSynth.stopAll();
                    setSelectedDifficulty(d.level);
                  }}
                  title={d.description}
                >
                  <span className={styles.folderTabTitle}>난이도 {d.level}</span>
                  <span className={styles.folderTabSub}>
                    {d.title.replace(/^난이도 \d — /, '')}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {activeMenu === 'range_test' && (
          <VocalRangeTest
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            isSimMode={isSimMode}
          />
        )}

        {activeMenu === 'training' && (
          <TrainingStudio
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onSaveRecord={handleSaveRecord}
            isSimMode={isSimMode}
            selectedMode={selectedTrainingMode}
            onSelectMode={setSelectedTrainingMode}
            selectedDiff={selectedDifficulty}
            isCertificationMode={false}
          />
        )}

        {activeMenu === 'cert_test' && (
          <TrainingStudio
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onSaveRecord={handleSaveRecord}
            isSimMode={isSimMode}
            selectedMode={selectedTrainingMode}
            onSelectMode={setSelectedTrainingMode}
            selectedDiff={selectedDifficulty}
            isCertificationMode={true}
          />
        )}

        {activeMenu === 'progress' && (
          <DailyProgress
            records={records}
            profile={profile}
            onClearRecords={handleClearRecords}
          />
        )}

        {activeMenu === 'voiceprint' && (
          <VoiceprintView
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            isSimMode={isSimMode}
          />
        )}

        {activeMenu === 'settings' && (
          <SettingsView
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            isSimMode={isSimMode}
            onToggleSimMode={toggleInputMode}
            simCentsOffset={simCentsOffset}
            onChangeSimCentsOffset={setSimCentsOffset}
            simVolume={simVolume}
            onChangeSimVolume={setSimVolume}
          />
        )}
      </main>
    </div>
  );
};
