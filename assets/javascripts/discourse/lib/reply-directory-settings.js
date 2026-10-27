export function replyDirectoryEnabled(topic, siteSettings) {
  if (!siteSettings.reply_titles_enabled) {
    return false;
  }

  const categories = (siteSettings.reply_titles_categories || "")
    .split("|")
    .filter(Boolean);

  return (
    categories.length === 0 || categories.includes(String(topic?.category_id))
  );
}
