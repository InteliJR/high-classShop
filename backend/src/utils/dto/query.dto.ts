export class QueryDto<T> {
    page: number;

    perPage: number;

    appliedFilters?: T;
}