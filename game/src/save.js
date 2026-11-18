// Porto Alba — save / load. Progress (money, missions finished, best wanted
// level) lives in localStorage so a session survives a reload. All guarded:
// a browser that blocks storage simply plays without saving.

const KEY = 'porto-alba-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || !data) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 250,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      bestWanted: typeof data.bestWanted === 'number' ? data.bestWanted : 0,
      totalEarned: typeof data.totalEarned === 'number' ? data.totalEarned : 0,
    };
  } catch (e) {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: Math.round(state.money),
      missionsDone: state.missionsDone,
      bestWanted: state.bestWanted,
      totalEarned: Math.round(state.totalEarned),
    }));
  } catch (e) {
    // Storage unavailable: play on without saving.
  }
}
