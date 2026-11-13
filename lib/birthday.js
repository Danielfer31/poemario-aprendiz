/** True on February 13 (local time), Loraine's birthday. */
export function isBirthday(now) {
  return now.getMonth() === 1 && now.getDate() === 13;
}
