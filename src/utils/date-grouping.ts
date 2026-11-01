import { MediaItem, SortOrder } from '@/types/gallery';

export interface DateGroup {
  id: string;
  title: string;
  subtitle?: string;
  items: MediaItem[];
}

export function groupMediaByDate(
  items: MediaItem[],
  sortOrder: SortOrder = 'desc'
): DateGroup[] {
  const groups: { [key: string]: DateGroup } = {};
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const yesterdayStart = todayStart - 86400000;

  items.forEach((item) => {
    const time = item.creationTime > 0 ? item.creationTime : 0;
    let dayStart = 0;
    let title = '';
    let subtitle = '';

    if (time <= 0) {
      dayStart = 0;
      title = 'Older Photos';
    } else {
      const itemDate = new Date(time);
      dayStart = new Date(
        itemDate.getFullYear(),
        itemDate.getMonth(),
        itemDate.getDate()
      ).getTime();

      if (dayStart === todayStart) {
        title = 'Today';
      } else if (dayStart === yesterdayStart) {
        title = 'Yesterday';
      } else {
        title = itemDate.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: itemDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
      }
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

  // Sort groups based on sortOrder
  const sortedGroups = Object.values(groups).sort((a, b) => {
    if (sortOrder === 'desc') {
      // Newest date groups first (Today, Yesterday, ..., Older)
      return Number(b.id) - Number(a.id);
    } else {
      // Oldest date groups first
      return Number(a.id) - Number(b.id);
    }
  });

  // Sort items inside each group deterministically with tie-breaker
  sortedGroups.forEach((group) => {
    group.items.sort((a, b) => {
      if (sortOrder === 'desc') {
        if (b.creationTime !== a.creationTime) {
          return b.creationTime - a.creationTime;
        }
        if (b.modificationTime !== a.modificationTime) {
          return b.modificationTime - a.modificationTime;
        }
        return b.id.localeCompare(a.id);
      } else {
        if (a.creationTime !== b.creationTime) {
          return a.creationTime - b.creationTime;
        }
        if (a.modificationTime !== b.modificationTime) {
          return a.modificationTime - b.modificationTime;
        }
        return a.id.localeCompare(b.id);
      }
    });
  });

  return sortedGroups;
}

