import type { MapFiltersState, MapReport, MapSort } from '../types/map';

const severityWeight = { Low: 1, Medium: 2, High: 3, Critical: 4 };
export const matchesMapFilters = (report: MapReport, filters: MapFiltersState): boolean => {
  const query = filters.search.toLowerCase();
  const searchable = `${report.city} ${report.reporter} ${report.title} ${report.address} ${report.id}`.toLowerCase();
  const age = Date.now() - Date.parse(report.createdAt);
  const dateLimits = { Today: 86400000, 'This week': 604800000, 'This month': 2592000000 };
  return (!query || searchable.includes(query)) &&
    (filters.severity === 'All' || report.severity === filters.severity) &&
    (filters.status === 'All' || report.status === filters.status) &&
    (filters.reporter === 'All' || report.reporter === filters.reporter) &&
    (filters.city === 'All' || report.city === filters.city) &&
    (filters.department === 'All' || report.department === filters.department) &&
    (filters.date === 'All' || age <= dateLimits[filters.date]);
};

export const sortMapReports = (reports: MapReport[], sort: MapSort): MapReport[] => [...reports].sort((first, second) => {
  if (sort === 'Oldest') return Date.parse(first.createdAt) - Date.parse(second.createdAt);
  if (sort === 'Highest Severity') return severityWeight[second.severity] - severityWeight[first.severity];
  if (sort === 'Alphabetical') return first.title.localeCompare(second.title);
  return Date.parse(second.createdAt) - Date.parse(first.createdAt);
});

export const uniqueMapValues = <K extends keyof MapReport>(reports: MapReport[], key: K): string[] => [...new Set(reports.map((report) => String(report[key])))].sort();
