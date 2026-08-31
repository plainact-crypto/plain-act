import { chromium, devices } from 'playwright';

const baseUrl = (process.env.PLAIN_ACT_URL || 'https://plain-act.com').replace(/\/$/, '');

const profiles = [
  { name: 'desktop', context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'mobile', context: { ...devices['Pixel 7'] } }
];

const tools = [
  {
    name: 'New Manager 30-Day Planner',
    path: '/tools/new-manager-30-day-planner/',
    testValues: ['PA_QA_TEAM_CONFLICT'],
    run: async (page) => {
      await page.selectOption('#team-size', 'medium');
      await page.selectOption('#transition', 'internal');
      await page.selectOption('#work-model', 'remote');
      await page.selectOption('#situation', 'conflict');
      await page.selectOption('#focus', 'delegation');
      await page.evaluate(() => {
        const marker = document.createElement('input');
        marker.type = 'hidden';
        marker.name = 'qaMarker';
        marker.value = 'PA_QA_TEAM_CONFLICT';
        document.querySelector('#planner-form')?.appendChild(marker);
      });
      await page.click('#planner-form button[type="submit"]');
      const text = await page.locator('#plan-output').innerText();
      if (!text.includes('NEW MANAGER 30-DAY PLAN') || !text.includes('Team conflict') || !text.includes('Delegation')) {
        throw new Error('30-Day Planner output did not contain expected generated content');
      }
    }
  },
  {
    name: 'Difficult Conversation Planner',
    path: '/tools/difficult-conversation-planner/',
    testValues: ['PA_QA_CONVERSATION_7319'],
    run: async (page) => {
      await page.fill('#happened', 'PA_QA_CONVERSATION_7319 client update was late');
      await page.fill('#behavior', 'the update was sent after the agreed deadline');
      await page.fill('#impact', 'the client review window became shorter');
      await page.fill('#outcome', 'send the update by the agreed deadline or escalate the risk early');
      await page.selectOption('#urgency', 'soon');
      await page.click('#conversation-form button[type="submit"]');
      const text = await page.locator('#brief-output').innerText();
      if (!text.includes('DIFFICULT CONVERSATION PREPARATION BRIEF') || !text.includes('PA_QA_CONVERSATION_7319')) {
        throw new Error('Conversation Planner output did not contain expected generated content');
      }
    }
  },
  {
    name: 'Delegation Brief Builder',
    path: '/tools/delegation-brief-builder/',
    testValues: ['PA_QA_DELEGATION_8421'],
    run: async (page) => {
      await page.fill('#outcome', 'PA_QA_DELEGATION_8421 completed client-ready draft');
      await page.fill('#deadline', 'Thursday 3 PM');
      await page.fill('#owner', 'QA Owner');
      await page.selectOption('#authority', 'decide-inform');
      await page.fill('#constraints', 'Use approved source material only');
      await page.fill('#checkpoints', 'Wednesday noon');
      await page.fill('#escalation', 'Escalate if the deadline is at risk');
      await page.click('#delegation-form button[type="submit"]');
      const text = await page.locator('#brief-output').innerText();
      if (!text.includes('DELEGATION BRIEF') || !text.includes('PA_QA_DELEGATION_8421') || !text.includes('DECIDE AND INFORM')) {
        throw new Error('Delegation Brief output did not contain expected generated content');
      }
    }
  }
];

const browser = await chromium.launch({ headless: true });
let failures = 0;

try {
  for (const profile of profiles) {
    for (const tool of tools) {
      const context = await browser.newContext(profile.context);
      const page = await context.newPage();
      const requestUrls = [];
      const requestBodies = [];

      page.on('request', (request) => {
        requestUrls.push(request.url());
        const data = request.postData();
        if (data) requestBodies.push(data);
      });

      try {
        const response = await page.goto(`${baseUrl}${tool.path}`, { waitUntil: 'networkidle', timeout: 45000 });
        if (!response || !response.ok()) throw new Error(`HTTP ${response?.status() ?? 'no response'}`);

        await tool.run(page);

        const outbound = `${requestUrls.join('\n')}\n${requestBodies.join('\n')}`;
        for (const value of tool.testValues) {
          if (outbound.includes(value)) {
            throw new Error(`Form test value leaked into a network request: ${value}`);
          }
        }

        const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        if (horizontalOverflow) throw new Error('Horizontal overflow detected');

        console.log(`PASS ${profile.name}: ${tool.name}`);
      } catch (error) {
        failures += 1;
        console.error(`FAIL ${profile.name}: ${tool.name}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

if (failures) {
  console.error(`Plain Act tools smoke failed: ${failures} case(s)`);
  process.exit(1);
}

console.log(`Plain Act tools smoke PASS: ${profiles.length * tools.length} cases`);
