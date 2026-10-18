export const POKEMONS_PER_PAGE = 50;

export function getOffsetForPage(page, limit = POKEMONS_PER_PAGE) {
  return (page - 1) * limit;
}

export function getTotalPages(count, limit = POKEMONS_PER_PAGE) {
  return Math.max(1, Math.ceil(count / limit));
}

export function parsePage(value) {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      type: "page",
      page: index + 1,
    }));
  }

  const pages = new Set([1, totalPages, currentPage]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  } else if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 2);
    pages.add(totalPages - 1);
  } else {
    pages.add(currentPage - 1);
    pages.add(currentPage + 1);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);

  const items = [];

  for (let index = 0; index < sortedPages.length; index++) {
    const page = sortedPages[index];
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push({ type: "ellipsis" });
    }

    items.push({ type: "page", page });
  }

  return items;
}

export function createPaginationView({ count, limit, currentPage }) {
  const totalPages = getTotalPages(count, limit);

  return {
    count,
    limit,
    currentPage,
    totalPages,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
    previousPage: Math.max(1, currentPage - 1),
    nextPage: Math.min(totalPages, currentPage + 1),
    items: buildPaginationItems(currentPage, totalPages).map((item) => ({
      ...item,
      isActive: item.type === "page" && item.page === currentPage,
    })),
  };
}
