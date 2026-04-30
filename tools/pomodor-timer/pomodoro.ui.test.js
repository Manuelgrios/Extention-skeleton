// pomodoro.ui.test.js - verifies popup timer messaging through the Chrome runtime API.

function createChromeMock(initialStorage = {}) {
  const storage = { ...initialStorage };

  return {
    runtime: {
      lastError: null,
      onInstalled: { addListener: jest.fn() },
      onMessage: { addListener: jest.fn() },
      onStartup: { addListener: jest.fn() },
      sendMessage: jest.fn((message, callback) => {
        if (callback) {
          callback({ success: true });
        }
      })
    },
    alarms: {
      create: jest.fn((name, info, callback) => callback && callback()),
      clear: jest.fn((name, callback) => callback && callback(true)),
      onAlarm: { addListener: jest.fn() }
    },
    notifications: {
      create: jest.fn((id, options, callback) => callback && callback(id))
    },
    storage: {
      local: {
        get: jest.fn((keys, callback) => {
          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map(key => [key, storage[key]])));
            return;
          }

          callback({ ...storage });
        }),
        set: jest.fn((values, callback) => {
          Object.assign(storage, values);

          if (callback) {
            callback();
          }
        })
      }
    },
    tabs: {
      create: jest.fn((properties, callback) => callback && callback({ id: 99, ...properties })),
      query: jest.fn((query, callback) => callback([])),
      update: jest.fn((tabId, properties, callback) => callback && callback({ id: tabId, ...properties }))
    }
  };
}

function setupPomodoroUi() {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="tab-tools">
      <div id="toolsList"></div>
    </div>
  `;
  global.chrome = createChromeMock();
  const pomodoro = require("./pomodoro.js");
  const background = require("../../background/background.js");

  window.FocusKitPomodoro.open();

  return { background, chrome: global.chrome, pomodoro };
}

function setDebugTime(minutes, seconds) {
  document.getElementById("pomodoroDebugToggle").click();
  document.getElementById("pomodoroDebugMinutes").value = minutes;
  document.getElementById("pomodoroDebugSeconds").value = seconds;
  document.getElementById("pomodoroDebugApply").click();
}

describe("Pomodoro popup completion messaging", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.chrome;
  });

  test("sends the background completion action once when the timer reaches zero", () => {
    const { background, chrome, pomodoro } = setupPomodoroUi();

    expect(pomodoro.POMODORO_COMPLETE_ACTION).toBe(background.MESSAGE_ACTIONS.pomodoroComplete);

    setDebugTime("0", "1");
    document.getElementById("pomodoroStart").click();
    chrome.runtime.sendMessage.mockClear();

    jest.setSystemTime(1000);
    jest.advanceTimersByTime(1000);
    jest.setSystemTime(2000);
    jest.advanceTimersByTime(1000);

    const completionMessages = chrome.runtime.sendMessage.mock.calls
      .map(call => call[0])
      .filter(message => message.action === background.MESSAGE_ACTIONS.pomodoroComplete);

    expect(completionMessages).toHaveLength(1);
    expect(document.getElementById("pomodoroTime").textContent).toBe("00:00");
  });

  test("debug changing and restarting allow a future completion message", () => {
    const { background, chrome } = setupPomodoroUi();

    setDebugTime("0", "1");
    document.getElementById("pomodoroStart").click();
    chrome.runtime.sendMessage.mockClear();

    jest.setSystemTime(1000);
    jest.advanceTimersByTime(1000);

    setDebugTime("0", "1");
    document.getElementById("pomodoroStart").click();

    jest.setSystemTime(2000);
    jest.advanceTimersByTime(1000);

    const completionMessages = chrome.runtime.sendMessage.mock.calls
      .map(call => call[0])
      .filter(message => message.action === background.MESSAGE_ACTIONS.pomodoroComplete);

    expect(completionMessages).toHaveLength(2);
  });
});
