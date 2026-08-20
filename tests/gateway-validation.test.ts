import { describe, expect, it } from "vitest";
import { getPasswordConfirmationState, isValidAccountIdentifier } from "../src/features/gateway/gateway-validation";

describe("注册字段校验", () => {
  it("只有两次输入完全一致且密码长度合格时才确认成功", () => {
    expect(getPasswordConfirmationState("1234567890", "")).toBe("idle");
    expect(getPasswordConfirmationState("1234567890", "1234567891")).toBe("mismatch");
    expect(getPasswordConfirmationState("123456789", "123456789")).toBe("idle");
    expect(getPasswordConfirmationState("1234567890", "1234567890")).toBe("match");
  });

  it("账号只接受 4–20 位字母、数字或下划线", () => {
    expect(isValidAccountIdentifier("story_user_01")).toBe(true);
    expect(isValidAccountIdentifier("abc")).toBe(false);
    expect(isValidAccountIdentifier("重复账号")).toBe(false);
  });
});
