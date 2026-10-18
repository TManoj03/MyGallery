import { MediaItem } from '@/types/gallery';

export interface DateGroup {
  id: string;
  title: string;
  subtitle?: string;
  items: MediaItem[];
}

export function groupMediaByDate(items: MediaItem[]): DateGroup[] {
  const groups: { [key: string]: DateGroup } = {};
  const now = new Date();
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStr = todayStr - 86400000;

  items.forEach((item) => {
    const itemDate = new Date(item.creationTime);
    const dayStart = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

    let title = '';
    let subtitle = '';

    if (dayStart === todayStr) {
      title = 'Today';
    } else if (dayStart === yesterdayStr) {
      title = 'Yesterday';
    } else {
      title = itemDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: itemDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }

    if (item.location?.city) {
      subtitle = item.location.country
        ? `${item.location.city}, ${item.location.country}`
        : item.location.city;
    }

    const key = `${dayStart}`;
    if (!groups[key]) {
      groups[key] = {
        id: key,
        title,
        subtitle,
        items: [],
      };
    }
    groups[key].items.push(item);
  });

  return Object.values(groups).sort((a, b) => Number(b.id) - Number(a.id));
}
