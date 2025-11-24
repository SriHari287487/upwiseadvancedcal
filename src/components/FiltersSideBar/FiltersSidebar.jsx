// FiltersSidebar.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  Box,
  IconButton,
  Typography,
  Paper,
  InputBase,
  Collapse,
  Button,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import CheckboxGroup from "../common/CheckBoxGroup";
import {
  useCalendarActions,
  useCalendarState,
} from "../../Context/CalendarContext";

/* ================== Style tokens ================== */

const SIDEBAR_WIDTH = 320;

const COLORS = {
  bg: "#FFFFFF",
  panelBorder: "#E6EEF8",
  cardBorder: "#E6EEF8",
  subtle: "#F6F9FB",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  accent: "#3B82F6",
};

const styles = {
  mainContainer: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: { xs: "100%", sm: SIDEBAR_WIDTH },
    zIndex: 1300,
    pointerEvents: "none",
    display: "flex",
    justifyContent: "flex-end",
    background: "transparent",
  },
  slidePanel: (open) => ({
    pointerEvents: "auto",
    height: "100%",
    width: "100%",
    maxWidth: SIDEBAR_WIDTH,
    display: "flex",
    flexDirection: "column",
    transform: open ? "translateX(0)" : "translateX(110%)",
    transition: "transform 0.30s cubic-bezier(.22,.9,.3,1)",
  }),
  filterContainer: {
    flex: 1,
    m: { xs: 0, sm: "12px 12px 12px 0" },
    borderRadius: { xs: 0, sm: "14px" },
    background: COLORS.bg,
    boxShadow: "0 8px 30px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderLeft: `1px solid ${COLORS.panelBorder}`,
  },
  headerRow: {
    flexShrink: 0,
    padding: "16px 18px 12px 18px",
    borderBottom: `1px solid ${COLORS.panelBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    background: COLORS.bg,
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 0.25,
  },
  headerTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 1,
  },
  chipPill: {
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    background: COLORS.subtle,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: "999px",
    border: `1px solid ${COLORS.panelBorder}`,
    color: COLORS.textSecondary,
    background: COLORS.bg,
    "&:hover": {
      backgroundColor: "#FBFDFF",
    },
  },
  sectionsScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    scrollbarWidth: "none",
    background: COLORS.bg,
    "&::-webkit-scrollbar": { display: "none" },
  },
  footerRow: {
    flexShrink: 0,
    padding: "12px 16px",
    borderTop: `1px solid ${COLORS.panelBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1.5,
    background: COLORS.bg,
  },
  sectionCard: {
    width: "100%",
    borderRadius: "12px",
    border: `1px solid ${COLORS.cardBorder}`,
    background: "#fff",
    boxShadow: "0 4px 12px rgba(16,24,40,0.03)",
  },
  sectionHeaderRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px 6px 12px",
    gap: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
  },
  searchBar: {
    margin: "6px 12px",
    padding: "6px 10px",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    color: COLORS.textSecondary,
    backgroundColor: COLORS.subtle,
    border: `1px solid ${COLORS.panelBorder}`,
  },
  sectionContent: {
    padding: "6px 12px 12px 12px",
  },
};

/* ================== Section subcomponent ================== */

function Section({
  title,
  children,
  collapsed,
  onToggle,
  searchOpen,
  onToggleSearch,
  searchValue,
  onSearchChange,
  onClearSearch,
}) {
  const borderColor = styles.sectionCard.border;
  const textColor = COLORS.textSecondary;

  return (
    <Box sx={styles.sectionCard}>
      <Box sx={styles.sectionHeaderRow}>
        <IconButton
          size="small"
          onClick={onToggle}
          sx={{
            color: textColor,
            mr: 0.5,
            borderRadius: 8,
          }}
        >
          {collapsed ? (
            <ExpandMoreIcon fontSize="small" />
          ) : (
            <ExpandLessIcon fontSize="small" />
          )}
        </IconButton>

        <Typography sx={styles.sectionTitle}>{title}</Typography>

        <IconButton
          size="small"
          onClick={onToggleSearch}
          sx={{
            ml: "auto",
            width: 34,
            height: 34,
            color: textColor,
            "&:hover": { backgroundColor: COLORS.subtle },
          }}
        >
          <SearchIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {searchOpen && (
        <Paper
          variant="outlined"
          sx={{
            ...styles.searchBar,
            boxShadow: "none",
          }}
        >
          <SearchIcon fontSize="small" sx={{ mr: 1, color: COLORS.textSecondary }} />
          <InputBase
            placeholder={`Search ${title.toLowerCase()}`}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{
              flex: 1,
              fontSize: 13,
              color: COLORS.textPrimary,
              "& input::placeholder": { color: COLORS.textSecondary },
            }}
          />
          {searchValue && (
            <IconButton size="small" onClick={onClearSearch}>
              <ClearIcon fontSize="small" sx={{ color: COLORS.textSecondary }} />
            </IconButton>
          )}
        </Paper>
      )}

      <Collapse in={!collapsed} unmountOnExit>
        <Box sx={styles.sectionContent}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/* ================== Main component ================== */

const FiltersSidebar = ({ open, onclose }) => {
  const {
    roles,
    hosts,
    userGroups,
    selectedRoleNames,
    selectedUserNames,
    selectedGroupIds,
  } = useCalendarState();
  const {
    setSelectedRoleNames,
    setSelectedUserNames,
    setSelectedGroupIds,
  } = useCalendarActions();

  const [collapsed, setCollapsed] = useState({
    roles: false,
    individuals: false,
    groups: false,
  });

  const [searchOpen, setSearchOpen] = useState({
    roles: false,
    individuals: false,
    groups: false,
  });

  const [query, setQuery] = useState({
    roles: "",
    individuals: "",
    groups: "",
  });

  const toggleCollapse = (key) =>
    setCollapsed((s) => ({ ...s, [key]: !s[key] }));
  const toggleSearch = (key) =>
    setSearchOpen((s) => ({ ...s, [key]: !s[key] }));
  const setQueryKey = (key, v) => setQuery((q) => ({ ...q, [key]: v }));
  const clearQueryKey = (key) => setQueryKey(key, "");


  // Filtered lists
  const filteredRoles = useMemo(() => {
    const q = query.roles.trim().toLowerCase();
    const arr = Array.isArray(roles) ? roles : [];
    if (!q) return arr;
    return arr.filter((r) => String(r.name || "").toLowerCase().includes(q));
  }, [roles, query.roles]);

  const filteredIndividuals = useMemo(() => {
    const q = query.individuals.trim().toLowerCase();
    const arr = Array.isArray(hosts) ? hosts : [];
    const base = arr.map((h) => h.name);
    if (!q) return base;
    return base.filter((n) => String(n || "").toLowerCase().includes(q));
  }, [hosts, query.individuals]);


  const filteredGroups = useMemo(() => {
    const q = query.groups.trim().toLowerCase();
    const arr = Array.isArray(userGroups) ? userGroups : [];
    if (!q) return arr;
    return arr.filter((g) =>
      String(g.name || "").toLowerCase().includes(q)
    );
  }, [userGroups, query.groups]);

  // selection handlers with mutual exclusion
  const handleRoleFilterChange = useCallback(
    (roleNamesArray) => {
      const next = roleNamesArray || [];
      setSelectedRoleNames(next);
      if (next.length > 0) {
        setSelectedUserNames([]);
        setSelectedGroupIds([]);
      }
    },
    [setSelectedRoleNames, setSelectedUserNames, setSelectedGroupIds]
  );

  const handleUserFilterChange = useCallback(
    (userNamesArray) => {
      const next = userNamesArray || [];
      setSelectedUserNames(next);
      if (next.length > 0) {
        setSelectedRoleNames([]);
        setSelectedGroupIds([]);
      }
    },
    [setSelectedUserNames, setSelectedRoleNames, setSelectedGroupIds]
  );


  const handleGroupFilterChange = useCallback(
    (groupIdsArray) => {
      const next = groupIdsArray || [];
      setSelectedGroupIds(next);
      if (next.length > 0) {
        setSelectedRoleNames([]);
        setSelectedUserNames([]);
      }
    },
    [setSelectedGroupIds, setSelectedRoleNames, setSelectedUserNames]
  );

  // active filter count
  const activeCount =
    (selectedRoleNames?.length || 0) +
    (selectedUserNames?.length || 0) +
    (selectedGroupIds?.length || 0);

  const hasActiveFilters = activeCount > 0;

  const handleClearAll = () => {
    setSelectedRoleNames([]);
    setSelectedUserNames([]);
    setSelectedGroupIds([]);
  };

  return (
    <Box sx={styles.mainContainer}>
      <Box sx={styles.slidePanel(open)}>
        <Box sx={styles.filterContainer}>
          {/* Header */}
          <Box sx={styles.headerRow}>
            <Box sx={styles.headerLeft}>
              <Box sx={styles.headerTitleRow}>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                    letterSpacing: 0.2,
                  }}
                >
                  Filters
                </Typography>
                <Box sx={styles.chipPill}>
                  {hasActiveFilters
                    ? `${activeCount.toString().padStart(2, "0")} active`
                    : "No active filters"}
                </Box>
              </Box>
              <Typography
                sx={{
                  fontSize: 12,
                  color: COLORS.textSecondary,
                }}
              >
                Limit the calendar by role, user, or group.
              </Typography>
            </Box>

            <IconButton onClick={onclose} sx={styles.closeButton}>
              <ClearIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* Sections */}
          <Box sx={styles.sectionsScroll}>
            <Section
              title="Roles"
              collapsed={collapsed.roles}
              onToggle={() => toggleCollapse("roles")}
              searchOpen={searchOpen.roles}
              onToggleSearch={() => toggleSearch("roles")}
              searchValue={query.roles}
              onSearchChange={(v) => setQueryKey("roles", v)}
              onClearSearch={() => clearQueryKey("roles")}
            >
              <CheckboxGroup
                items={filteredRoles}
                selected={selectedRoleNames}
                onChange={handleRoleFilterChange}
                getLabel={(r) => r.name}
                getValue={(r) => r.name}
              />
            </Section>

            <Section
              title="Users"
              collapsed={collapsed.individuals}
              onToggle={() => toggleCollapse("individuals")}
              searchOpen={searchOpen.individuals}
              onToggleSearch={() => toggleSearch("individuals")}
              searchValue={query.individuals}
              onSearchChange={(v) => setQueryKey("individuals", v)}
              onClearSearch={() => clearQueryKey("individuals")}
            >
              <CheckboxGroup
                items={filteredIndividuals}
                selected={selectedUserNames}
                onChange={handleUserFilterChange}
              />
            </Section>


            <Section
              title="Groups"
              collapsed={collapsed.groups}
              onToggle={() => toggleCollapse("groups")}
              searchOpen={searchOpen.groups}
              onToggleSearch={() => toggleSearch("groups")}
              searchValue={query.groups}
              onSearchChange={(v) => setQueryKey("groups", v)}
              onClearSearch={() => clearQueryKey("groups")}
            >
              <CheckboxGroup
                items={filteredGroups}
                selected={selectedGroupIds}
                onChange={handleGroupFilterChange}
                getLabel={(g) => g.name}
                getValue={(g) => g.id}
              />
            </Section>
          </Box>

          {/* Footer */}
          {/* Footer */}
<Box sx={styles.footerRow}>
  <Typography
    sx={{
      fontSize: 12,
      color: COLORS.textSecondary,
      flex: 1,           // take remaining space
      minWidth: 0,       // allow text to shrink
      pr: 1,             // small space before button
    }}
  >
    Filters apply instantly as you select them.
  </Typography>

  <Button
    size="small"
    variant="outlined"
    disabled={!hasActiveFilters}
    onClick={handleClearAll}
    sx={{
      textTransform: "none",
      fontSize: 12,
      borderRadius: 999,
      borderColor: COLORS.cardBorder,
      color: COLORS.textPrimary,
      px: 1.5,
      py: 0.5,
      flexShrink: 0,       // don't let button shrink
      whiteSpace: "nowrap" // keep "Clear all" on one line
    }}
  >
    Clear all
  </Button>
</Box>

        </Box>
      </Box>
    </Box>
  );
};

export default FiltersSidebar;
