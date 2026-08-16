import { describe, expect, it } from "vitest";
import { moderateStory } from "../src/moderation";

function check(title: string, body: string) {
  return moderateStory(`${title}\n${body}`, title, body);
}

/*
 * 审核的两头都要守住：
 *   漏判 —— 真正的求助信号被放过去（代价最大）
 *   误判 —— 正常的人生故事被拦下来（会把用户直接赶走）
 * 下面两组用例就是这两条边界。加词表或改匹配逻辑时，两组都必须继续通过。
 */

describe("必须拦下来的内容", () => {
  const mustFlag: Array<[string, string, string]> = [
    ["标题只有一个自伤词（没有上下文可以消歧）", "die", "今天天气很好，我去公园散步。"],
    ["标题自伤词 + 正文具体方法", "die", "jump off a building killmyself"],
    ["正文写了具体方法", "搬家那天", "jump off a building killmyself"],
    ["拼错的自伤短语（字母调换）", "away", "die killmyslef"],
    ["拼错的自伤短语（漏字母）", "away", "i want to kil myself"],
    ["拼错的方法描述", "away", "jump of a buildin"],
    ["中文自伤表达", "那一年", "我那时候真的想过自杀。"],
    ["中文危机信号", "", "我想结束这一切，我已经准备好了。"],
    ["英文回顾性自伤叙述", "That winter", "There was a year when I wanted to die almost every morning."],
    ["人身攻击", "同事", "他就是个傻逼，什么都做不好。"],
    ["隐私泄露（手机号）", "找人", "有事联系我 13800138000。"],
    ["广告垃圾", "推荐", "加我微信，限时折扣，代购全球好物。"],
  ];

  for (const [name, title, body] of mustFlag) {
    it(name, () => {
      const result = check(title, body);
      expect(result.hits.length, `「${title}」应该被拦下`).toBeGreaterThan(0);
      expect(result.level).not.toBeNull();
    });
  }

  it("标题和正文各有信号时，两处都要报出来", () => {
    const result = check("die", "jump off a building killmyself");
    const places = result.hits.map(hit => hit.where);
    expect(places).toContain("title");
    expect(places).toContain("body");
  });

  it("同一个词在标题和正文都出现时合成一条，标为 both", () => {
    const result = check("傻逼", "他说我是傻逼，我当时没回嘴。");
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].where).toBe("both");
  });

  it("当下危机信号走独立通道", () => {
    const result = check("", "我现在就想死。");
    expect(result.crisis).toBe(true);
    expect(result.level).toBe("L3");
  });
});

describe("必须放行的正常故事", () => {
  const mustPass: Array<[string, string]> = [
    ["奶奶去世了", "奶奶去世那年我十二岁，那是我第一次理解告别。她的手很粗糙，冬天总是暖的。"],
    ["The day my grandmother died", "She died in spring. I still think about her hands, and the way she hummed while cooking."],
    ["Dead End Road", "We drove until the road stopped and then walked back. My sister laughed the whole way."],
    ["Kill the lights", "We killed the lights and sat in the dark, talking until morning about everything we were afraid of."],
    ["My skill set", "I built my skill set slowly. Myself and two friends started a small studio above a bakery."],
    ["死磕到底", "那年我决定死磕到底，把这个项目做完，哪怕没有人看好。"],
    ["搬家那天", "我把最后一箱书搬上车，回头看了一眼这间住了四年的房子。"],
    ["away", "i came from singapore, its a very small place. 新加坡很小，而中国很大。在决定来中国留学之前，我既期待又害怕。"],
    ["A quiet promotion", "I was thrilled about my promotion, until I learned it came at the cost of my closest friend being laid off."],
    ["和父亲的一次争吵", "我们吵得很凶，后来我才明白，那背后是两代人不同的害怕。"],
    ["The station in the rain", "She realised what she remembered was not the destination, but the faces of strangers on the platform."],
    ["轻舟已过万重山", "当时觉得天要塌了，现在回头看，那只是一段很长的雨季。"],
    ["My first job", "The work was dull and the pay was worse, but I learned how to ask for help."],
    ["写给十年后的自己", "希望你还愿意为一些没有用的东西花时间。"],
    ["Letting go", "It took me three years to stop checking whether they had read my messages."],
    ["A talk with myself", "If my past self could talk with me now, I think she would be relieved I am still writing."],
  ];

  for (const [title, body] of mustPass) {
    it(`《${title}》`, () => {
      const result = check(title, body);
      expect(result.hits.map(hit => `${hit.category}:"${hit.term}"`), `《${title}》不该被拦`).toEqual([]);
      expect(result.level).toBeNull();
    });
  }
});

describe("性能", () => {
  it("1500 字的故事在 100ms 内跑完", () => {
    const body = "我来自新加坡，那年冬天我第一次一个人坐了很久的火车。".repeat(60);
    const started = Date.now();
    moderateStory(body, "一段很长的故事", body);
    expect(Date.now() - started).toBeLessThan(100);
  });
});
