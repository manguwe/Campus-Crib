// Campuses are now admin-managed data, not a hardcoded list - see
// 22_campuses_table.sql and src/context/CampusesContext.jsx (useCampuses()).
// This file is kept only as a shape reference for what a campus record
// looks like; it exports nothing, so any stray old import of CAMPUSES/
// DEFAULT_CAMPUS_ID/getCampusById from here fails loudly at build time
// instead of silently falling back to stale, hardcoded campus data.
//
// Shape of a row from the `campuses` table / useCampuses().campuses:
//   { id: uuid, name: string, latitude: number, longitude: number, is_active: boolean }
export {}
