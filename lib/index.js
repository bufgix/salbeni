#! /usr/bin/env node

const playwright = require("playwright");
const inquirer = require("inquirer");
const configuration = require("../config/config.json");

inquirer.registerPrompt("datetime", require("inquirer-datepicker-prompt"));

let browser;

const URL = "https://lms.ktun.edu.tr/login/login_auth.php";

class UserConfig {
  constructor({ username, password, targetLesson = {} }) {
    this.username = username;
    this.password = password;
    this.targetLesson = targetLesson;
  }
}

class Browser {
  constructor(url) {
    this.url = url;
    this.browser;
    this.context;
    this.page;
    this.page2;

    this.lessons = [];
  }

  static makeDay(date) {
    const today = date;
    return new String(today.setHours(0, 0, 0)).substring(
      0,
      new String(1604350800).length
    );
  }

  async build() {
    this.browser = await playwright["firefox"].launch({ headless: configuration.headless === false ? false : true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    await this.page.goto(this.url);
    await this.page.waitForTimeout(1000);
    return this;
  }

  async login(userConfig) {
    await this.page.fill("[id='username']", userConfig.username);
    await this.page.fill("[id='password']", userConfig.password);
    await this.page.click("[id='loginbtn']");
    return this.page
      .waitForSelector("h1.page-title", { timeout: 5000 })
      .then(() => {
        return Promise.resolve(this.browser);
      })
      .catch(() => {
        return Promise.reject(new Error("Kullanici adı veya şifre hatalı"));
      });
  }

  async getLessons(date) {
    await this.page.waitForTimeout(700);
    await this.page.click(`[data-day-timestamp='${Browser.makeDay(date)}']`);
    await this.page.waitForTimeout(700);
    const lessonsNodes = await this.page.$$eval("div.event", (events) => {
      return events.map((d) => ({
        id: d.getAttribute("data-event-id"),
        name: d.getAttribute("data-event-title"),
      }));
    });
    this.lessons = lessonsNodes;
    return lessonsNodes;
  }

  async goLesson(lessonID) {
    await this.page.waitForTimeout(1000);
    await this.page.click(`[data-event-id='${lessonID}'] a.btn`);
    await this.page.waitForSelector("text=Toplantıya Katıl");
    const link = await this.page.$eval("div.aconbtnjoin1 > a ", (el) =>
      el.getAttribute("href")
    );
    this.page2 = await this.context.newPage();
    await this.page2.goto(link);
    await this.page2.click("div#adim1 > a");
    await this.page2.waitForTimeout(500);
    await this.page2.click("div#adim2 > a");
    await this.page2.waitForTimeout(1000);
    await this.page2.click("[aria-label='Tarayıcıda aç']");
    await this.page2.waitForTimeout(10000);
    await this.page2.screenshot({ path: "adobe.png" });
    log("Toplantıdasınız", "success");
  }
}

process.on("SIGINT", function () {
  log("Ayrılıyor...", "warn");
  if (browser) browser.close();
});

const levels = {
  info: "🟢",
  warn: "⚠️",
  error: "❗",
  success: "✅",
};

const log = (message, level = "info") => {
  console.log(`${levels[level]} ${message}`);
};

(async () => {
  const questions = [
    {
      type: "input",
      name: "username",
      message: "Kullanıcı Adı",
      default: configuration && configuration.username == false ? null : configuration.username,
    },
    {
      type: "password",
      name: "password",
      message: "Şifre",
      default: configuration && configuration.password == false ? null : configuration.password,
    },
    {
      type: "datetime",
      name: "date",
      message: "Hangi Gün",
      format: ["mm", "/", "dd", "/", "yyyy"],
    },
  ];
  inquirer.prompt(questions).then(async ({ username, password, date }) => {
    const config = new UserConfig({
      username,
      password,
    });
    log("Başlatılıyor...");
    const browser = await new Browser(URL).build();
    browser
      .login(config)
      .then(async () => {
        log("Giriş başarılı");
        await browser.getLessons(date);
        inquirer
          .prompt({
            type: "list",
            name: "lesson",
            message: "Hangi derse katılamak istiyorsunuz",
            choices: browser.lessons.map((d) => d.name),
          })
          .then(({ lesson }) => {
            config.targetLesson = browser.lessons.find(
              (d) => d.name === lesson
            );
            browser.goLesson(config.targetLesson.id);
          });
      })
      .catch(console.error);
  });
})();
