/**
 * 保存系 API のエラーをユーザーに必ず見せ、成功時は reload を await する。
 */
export async function runSave(
  save: () => Promise<unknown>,
  reload: (() => void) | (() => Promise<void>)
): Promise<boolean> {
  try {
    await save();
    await Promise.resolve(reload());
    return true;
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '保存に失敗しました');
    return false;
  }
}
