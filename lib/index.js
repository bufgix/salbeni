#! /usr/bin/env node

const playwright = require("playwright");
const inquirer = require("inquirer");

let browser;

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

const makeDay = () => {
  const today = new Date();
  return new String(today.setHours(0, 0, 0)).substring(
    0,
    new String(1604350800).length
  );
};

const adobeState = async (context, link) => {
  log("Abode connect'e bağlanılıyor");
  const page = await context.newPage();
  await page.goto(link);
  await page.click("div#adim1 > a");
  await page.waitForTimeout(500);
  await page.click("div#adim2 > a");
  await page.waitForSelector("div.button-text");
  await page.waitForTimeout(1000);
  await page.click("[aria-label='Tarayıcıda aç']");
  await page.waitForTimeout(10000);
  await page.screenshot({ path: "adobe.png" });
  log("Toplantıdasınız !", "success");
};

const lmsState = async ({ username, password }) => {
  log("Başlatılıyor...");
  browser = await playwright["firefox"].launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  log("Lms'ye bağlanıyor...");
  await page.goto("https://lms.ktun.edu.tr/login/login_auth.php");
  await page.waitForTimeout(1000);
  log("Giriş yapılıyor...");
  await page.fill("[id='username']", username);
  await page.fill("[id='password']", password);
  await page.click("[id='loginbtn']");
  page.waitForSelector("h1.page-title").then(async () => {
    log("Bugunün tarihi olan derse giriliyor...");
    await page.click(`[data-day-timestamp='${makeDay()}']`);
    await page.waitForSelector("h1.page-title");
    await page.click("text=Etkinliğe git");
    await page.waitForSelector("text=Toplantıya Katıl");
    const link = await page.$eval("div.aconbtnjoin1 > a ", (el) =>
      el.getAttribute("href")
    );

    await adobeState(context, link);
  });
};

(async () => {
  const questions = [
    {
      type: "input",
      name: "username",
      message: "Kullanıcı Adı",
    },
    {
      type: "password",
      name: "password",
      message: "Şifre",
    },
  ];
  inquirer.prompt(questions).then(async ({ username, password }) => {
    await lmsState({ username, password });
  });
})();
