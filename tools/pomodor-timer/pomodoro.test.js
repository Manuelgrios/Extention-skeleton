// pomodoro.test.js - covers pure Pomodoro timer state transitions and formatting.

const {
  POMODORO_DURATION_SECONDS,
  applyPomodoroDebugTime,
  createInitialPomodoroState,
  formatTime,
  pausePomodoro,
  parsePomodoroDebugSeconds,
  resetPomodoro,
  restorePomodoroState,
  startPomodoro,
  tickPomodoro
} = require("./pomodoroState.js");

describe("Pomodoro timer state", () => {
  test("initial state is 25:00 and paused", () => {
    const state = createInitialPomodoroState(1000);

    expect(state.remainingSeconds).toBe(POMODORO_DURATION_SECONDS);
    expect(state.isRunning).toBe(false);
    expect(formatTime(state.remainingSeconds)).toBe("25:00");
  });

  test("start changes state to running", () => {
    const state = startPomodoro(createInitialPomodoroState(1000), 2000);

    expect(state.isRunning).toBe(true);
    expect(state.remainingSeconds).toBe(POMODORO_DURATION_SECONDS);
    expect(state.lastUpdatedAt).toBe(2000);
  });

  test("pause changes state to paused without resetting time", () => {
    const running = startPomodoro(createInitialPomodoroState(1000), 1000);
    const paused = pausePomodoro(running, 61000);

    expect(paused.isRunning).toBe(false);
    expect(paused.remainingSeconds).toBe(POMODORO_DURATION_SECONDS - 60);
  });

  test("reset restores 25:00 and paused state", () => {
    const state = resetPomodoro(3000);

    expect(state.remainingSeconds).toBe(POMODORO_DURATION_SECONDS);
    expect(state.isRunning).toBe(false);
    expect(state.lastUpdatedAt).toBe(3000);
  });

  test("timer formatting displays mm:ss", () => {
    expect(formatTime(1500)).toBe("25:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(0)).toBe("00:00");
  });

  test("debug time can set the remaining time", () => {
    const state = applyPomodoroDebugTime(createInitialPomodoroState(1000), "2", "30", 2000);

    expect(state.remainingSeconds).toBe(150);
    expect(state.isRunning).toBe(false);
    expect(state.lastUpdatedAt).toBe(2000);
    expect(formatTime(state.remainingSeconds)).toBe("02:30");
  });

  test("debug time rejects invalid values safely", () => {
    const initialState = createInitialPomodoroState(1000);

    expect(parsePomodoroDebugSeconds("abc", "10")).toBeNull();
    expect(parsePomodoroDebugSeconds("2", "90")).toBeNull();
    expect(applyPomodoroDebugTime(initialState, "abc", "10", 2000)).toEqual(initialState);
  });

  test("debug time blocks negative values", () => {
    const initialState = createInitialPomodoroState(1000);

    expect(parsePomodoroDebugSeconds("-1", "0")).toBeNull();
    expect(applyPomodoroDebugTime(initialState, "-1", "0", 2000)).toEqual(initialState);
  });

  test("debug time updates saved Pomodoro state shape", () => {
    const state = applyPomodoroDebugTime(createInitialPomodoroState(1000), "3", "5", 2000);
    const storagePayload = { pomodoroState: state };

    expect(storagePayload.pomodoroState.remainingSeconds).toBe(185);
    expect(storagePayload.pomodoroState.isRunning).toBe(false);
  });

  test("start, pause, and countdown behavior still work after debug time is applied", () => {
    const debugState = applyPomodoroDebugTime(createInitialPomodoroState(1000), "0", "5", 2000);
    const running = startPomodoro(debugState, 3000);
    const afterTwoSeconds = tickPomodoro(running, 5000);
    const paused = pausePomodoro(afterTwoSeconds, 6000);

    expect(afterTwoSeconds.remainingSeconds).toBe(3);
    expect(afterTwoSeconds.isRunning).toBe(true);
    expect(paused.remainingSeconds).toBe(2);
    expect(paused.isRunning).toBe(false);
  });

  test("saved Pomodoro state restores correctly", () => {
    const saved = {
      remainingSeconds: 1200,
      isRunning: false,
      lastUpdatedAt: 5000
    };

    expect(restorePomodoroState(saved, 10000)).toEqual(saved);
  });

  test("countdown logic reduces remaining time", () => {
    const running = startPomodoro(createInitialPomodoroState(1000), 1000);
    const afterFiveSeconds = tickPomodoro(running, 6000);

    expect(afterFiveSeconds.remainingSeconds).toBe(POMODORO_DURATION_SECONDS - 5);
    expect(afterFiveSeconds.isRunning).toBe(true);
  });

  test("timer never goes below 00:00", () => {
    const running = {
      remainingSeconds: 2,
      isRunning: true,
      lastUpdatedAt: 1000
    };
    const elapsed = tickPomodoro(running, 10000);

    expect(elapsed.remainingSeconds).toBe(0);
    expect(formatTime(elapsed.remainingSeconds)).toBe("00:00");
    expect(elapsed.isRunning).toBe(false);
  });
});
