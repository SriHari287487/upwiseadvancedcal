import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  InputBase,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Pagination,
  Typography,
  Popover,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useCalendarActions, useCalendarState } from "../../Context/CalendarContext";
import {
  getModuleList,
  fetchAllRecords,
  getFieldsMeta,
  searchModuleRecords,
} from "../../Apis/zohoApi";

const soft = "#9AA2B3";
const PER_PAGE = 30;

function formatCell(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.name) return v.name;
    if (v.display_value) return v.display_value;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export default function OpportunityLookupModal({ open, onClose, onSelect }) {
  const { moduleList } = useCalendarState();
  const { setModuleList } = useCalendarActions();

  const [relatedTo, setRelatedTo] = useState("Leads");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [checkedId, setCheckedId] = useState(null);
  const [records, setRecords] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const [moduleFields, setModuleFields] = useState([]);
  const [visibleCols, setVisibleCols] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [colFilters, setColFilters] = useState({});

  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const columnsMenuOpen = Boolean(columnsAnchorEl);

  // search debounce helpers
  const searchTimer = useRef(null);
  const lastQueryRef = useRef("");
  const prevQueryLenRef = useRef(0);

  /* ---------------------------
     Init on open
  ---------------------------- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        if (!moduleList || moduleList.length === 0) {
          const list = await getModuleList();
          if (!cancelled) setModuleList(list || []);
        }
      } catch {
        // ignore
      }

      if (!cancelled) {
        setRelatedTo("Leads");
        setPage(1);
        setCheckedId(null);
        setQuery("");
        setColFilters({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, moduleList, setModuleList]);

  /* ---------------------------
     Fetch base records + fields
     when module / page changes
     (NOT tied to search)
  ---------------------------- */
  useEffect(() => {
    if (!open || !relatedTo) return;
    let cancelled = false;

    const load = async () => {
      // 1) base paged data — Zoho already limits to PER_PAGE
      const res = await fetchAllRecords(relatedTo, page, PER_PAGE);
      const list = Array.isArray(res) ? res : [];

      // If we got a "full" page, assume there may be another page
      const hasMore = list.length === PER_PAGE;

      if (!cancelled) {
        setRecords(list);
        setTotalPages(hasMore ? page + 1 : Math.max(1, page));
        setCheckedId(null);
      }

      // 2) fields for module
      const fields = await getFieldsMeta(relatedTo);
      const normalized =
        (fields || []).map((f) => ({
          api_name: f.api_name,
          label: f.label || f.field_label || f.display_label || f.api_name,
        })) || [];

      if (!cancelled) {
        setModuleFields(normalized);

        // initialize / repair visible columns
        if (!visibleCols.length) {
          setVisibleCols(normalized.slice(0, 7).map((f) => f.api_name));
        } else {
          const allowed = new Set(normalized.map((f) => f.api_name));
          const next = visibleCols.filter((c) => allowed.has(c));
          setVisibleCols(
            next.length ? next : normalized.slice(0, 7).map((f) => f.api_name)
          );
        }
        // DO NOT reset colFilters here, so filter inputs are preserved
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, relatedTo, page]);

  /* ---------------------------
     Column / filter helpers
  ---------------------------- */
  const filteredModules = useMemo(
    () => (Array.isArray(moduleList) ? moduleList : []),
    [moduleList]
  );

  const allowedRelateds = ["Leads", "Contacts", "Accounts", "Deals"];
  console.log("filteredModules",filteredModules)

  const columnDefs = useMemo(
    () => moduleFields.filter((f) => visibleCols.includes(f.api_name)),
    [moduleFields, visibleCols]
  );

  // client-side column filters on current page
  const displayRows = useMemo(() => {
    const colChecks = Object.entries(colFilters)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => [k, v.trim().toLowerCase()]);

    return records.filter((rec) => {
      for (const [api, val] of colChecks) {
        if (!String(rec?.[api] ?? "").toLowerCase().includes(val)) return false;
      }
      return true;
    });
  }, [records, colFilters]);

  const toggleFieldVisible = (apiName) => {
    setVisibleCols((prev) =>
      prev.includes(apiName)
        ? prev.filter((x) => x !== apiName)
        : [...prev, apiName]
    );
  };

  /* ---------------------------
     Debounced global search
     using searchModuleRecords
     - query >= 4 chars → remote search
     - transition from >=4 → <4 → reload base list
  ---------------------------- */
  useEffect(() => {
    if (!open) return;

    if (searchTimer.current) window.clearTimeout(searchTimer.current);

    const q = query.trim();
    const prevLen = prevQueryLenRef.current;
    const len = q.length;
    prevQueryLenRef.current = len;

    // If query too short: restore base records only when coming back
    // from a "real" search.
    if (len < 4) {
      if (prevLen >= 4) {
        (async () => {
          const res = await fetchAllRecords(relatedTo, page, PER_PAGE);
          const list = Array.isArray(res) ? res : [];
          const hasMore = list.length === PER_PAGE;

          setRecords(list);
          setTotalPages(hasMore ? page + 1 : Math.max(1, page));
          setCheckedId(null);
        })();
      }
      return;
    }

    // Real search with debounce
    searchTimer.current = window.setTimeout(async () => {
      lastQueryRef.current = q;
      const rows = await searchModuleRecords(relatedTo, q);
      if (lastQueryRef.current !== q) return; // ignore stale

      const list = Array.isArray(rows) ? rows.slice(0, PER_PAGE) : [];
      setRecords(list);
      setTotalPages(1); // search results are shown on a single page (max 30)
      setPage(1);
      setCheckedId(null);
    }, 350);

    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [open, query, relatedTo, page]);

  /* ---------------------------
     Row selection
  ---------------------------- */
  const toggleCheck = (row) => {
    const id = row.id || row.ID || row._id;
    setCheckedId(id);
    if (onSelect) onSelect(row);
  };

  /* ---------------------------
     UI
  ---------------------------- */
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      sx={{ backdropFilter: "#F7F8FA" }}
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", bgcolor: "#fff" } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          color: soft,
          fontWeight: 600,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
          <Typography sx={{ color: soft, fontWeight: 500, fontSize: 20 }}>
            Related to
          </Typography>

          <Select
            size="small"
            value={relatedTo}
            onChange={(e) => {
              setRelatedTo(e.target.value);
              setPage(1);
              setQuery("");
              setCheckedId(null);
              setColFilters({});
            }}
            displayEmpty
            MenuProps={{
              disablePortal: true,
              PaperProps: {
                sx: {
                  maxHeight: 300,
                  borderRadius: 2,
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                },
              },
            }}
            sx={{
              minWidth: 200,
              height: 36,
              fontSize: 14,
              color: "#9AA2B3",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#9AA2B3",
                borderRadius: 2,
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#9AA2B3",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#9AA2B3",
              },
            }}
            renderValue={(selected) => {
              const item = (moduleList || []).find((m) => m.api_name === selected);
              if (!item) return "Select Module";
              // primary: label, fallback: secondary_label, final fallback: singular_label
              return item.label || item.secondary_label || item.singular_label;
            }}
          >
            {(filteredModules.length > 0
              ? filteredModules
              : [{ api_name: "", singular_label: "No results" }]
            ).filter((m) => allowedRelateds.includes(m.api_name)).map((m, idx) => (
              <MenuItem
                key={m.api_name || `empty-${idx}`}
                value={m.api_name}
                disabled={!m.api_name}
                sx={{ fontSize: 14, color: "#4C566A" }}
              >
                {(m.label || m.secondary_label || m.singular_label) ?? "—"}
              </MenuItem>
            ))}
          </Select>

          {/* 🔎 global search */}
          <Paper
            variant="outlined"
            sx={{
              ml: 1,
              flex: 1,
              display: "flex",
              alignItems: "center",
              px: 1,
              py: 0.25,
              borderRadius: 2,
              borderColor: soft,
            }}
          >
            <InputBase
              placeholder="Search (min 4 chars)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{
                flex: 1,
                fontSize: 14,
                color: soft,
                "& input::placeholder": { color: soft, opacity: 1 },
              }}
            />
          </Paper>

          {/* Filter toggle */}
          <IconButton
            size="small"
            onClick={() => setShowFilters((s) => !s)}
            sx={{
              padding: "3px",
              "&.MuiIconButton-root:hover": {
                borderRadius: "8px",
                backgroundColor: "#9aa2b330",
              },
            }}
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2.93542 6.9866H16.1962C16.5958 8.80402 18.2204 10.1684 20.1579 10.1684C22.0954 10.1684 23.7199 8.80407 24.1196 6.9866H29.0645C29.5454 6.9866 29.9354 6.597 29.9354 6.11648C29.9354 5.63595 29.5454 5.24635 29.0645 5.24635H24.1192C23.7187 3.42986 22.0919 2.06458 20.1579 2.06458C18.2228 2.06458 16.5968 3.42964 16.1965 5.24635H2.93542C2.45443 5.24635 2.06445 5.63595 2.06445 6.11648C2.06445 6.597 2.45443 6.9866 2.93542 6.9866ZM17.844 6.11876C17.844 6.11566 17.8441 6.1125 17.8441 6.10941C17.8479 4.83864 18.8858 3.80488 20.1579 3.80488C21.4281 3.80488 22.4661 4.83723 22.4716 6.10739L22.4718 6.12017C22.4698 7.39311 21.4325 8.42823 20.1579 8.42823C18.8838 8.42823 17.8469 7.39414 17.844 6.12197L17.844 6.11876ZM29.0645 25.0135H24.1192C23.7187 23.197 22.0919 21.8317 20.1579 21.8317C18.2228 21.8317 16.5968 23.1968 16.1965 25.0135H2.93542C2.45443 25.0135 2.06445 25.403 2.06445 25.8836C2.06445 26.3642 2.45443 26.7537 2.93542 26.7537H16.1962C16.5958 28.5711 18.2204 29.9355 20.1579 29.9355C22.0954 29.9355 23.7199 28.5711 24.1196 26.7537H29.0645C29.5454 26.7537 29.9354 26.3642 29.9354 25.8836C29.9354 25.403 29.5454 25.0135 29.0645 25.0135ZM20.1579 28.1953C18.8838 28.1953 17.8469 27.1612 17.844 25.889L17.844 25.8859C17.844 25.8827 17.8441 25.8796 17.8441 25.8765C17.8479 24.6058 18.8858 23.5719 20.1579 23.5719C21.4281 23.5719 22.4661 24.6043 22.4716 25.8744L22.4718 25.8872C22.4699 27.1603 21.4327 28.1953 20.1579 28.1953ZM29.0645 15.1299H15.8037C15.404 13.3125 13.7795 11.9482 11.842 11.9482C9.90452 11.9482 8.27995 13.3125 7.88029 15.1299H2.93542C2.45443 15.1299 2.06445 15.5195 2.06445 16.0001C2.06445 16.4806 2.45443 16.8702 2.93542 16.8702H7.88072C8.2812 18.6866 9.90795 20.052 11.842 20.052C13.7771 20.052 15.4031 18.6868 15.8034 16.8702H29.0645C29.5454 16.8702 29.9354 16.4806 29.9354 16.0001C29.9354 15.5195 29.5454 15.1299 29.0645 15.1299ZM14.1558 15.9978C14.1558 16.0009 14.1558 16.004 14.1558 16.0071C14.152 17.2779 13.114 18.3117 11.842 18.3117C10.5717 18.3117 9.53376 17.2793 9.52827 16.0092L9.5281 15.9965C9.53001 14.7234 10.5673 13.6884 11.842 13.6884C13.1161 13.6884 14.153 14.7224 14.1559 15.9947L14.1558 15.9978Z"
                fill="#ADB8CC"
              />
            </svg>
          </IconButton>

          {/* Column chooser */}
          <IconButton
            size="small"
            onClick={(e) => setColumnsAnchorEl(e.currentTarget)}
            sx={{
              padding: "3px",
              "&.MuiIconButton-root:hover": {
                borderRadius: "8px",
                backgroundColor: "#9aa2b330",
              },
            }}
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="0.5" y="0.5" width="35" height="35" rx="9.5" stroke="#9AA2B3" />
              <path
                d="M10.125 21.0938C8.415 21.0938 7.03125 19.71 7.03125 18C7.03125 16.29 8.415 14.9062 10.125 14.9062C11.835 14.9062 13.2188 16.29 13.2188 18C13.2188 19.71 11.835 21.0938 10.125 21.0938ZM10.125 16.5938C9.34875 16.5938 8.71875 17.2238 8.71875 18C8.71875 18.7762 9.34875 19.4062 10.125 19.4062C10.9012 19.4062 11.5312 18.7762 11.5312 18C11.5312 17.2238 10.9012 16.5938 10.125 16.5938Z"
                fill="#ADB8CC"
              />
              <path
                d="M25.875 21.0938C24.165 21.0938 22.7812 19.71 22.7812 18C22.7812 16.29 24.165 14.9062 25.875 14.9062C27.585 14.9062 28.9688 16.29 28.9688 18C28.9688 19.71 27.585 21.0938 25.875 21.0938ZM25.875 16.5938C25.0988 16.5938 24.4688 17.2238 24.4688 18C24.4688 18.7762 25.0988 19.4062 25.875 19.4062C26.6512 19.4062 27.2812 18.7762 27.2812 18C27.2812 17.2238 26.6512 16.5938 25.875 16.5938Z"
                fill="#ADB8CC"
              />
              <path
                d="M18 21.0938C16.29 21.0938 14.9062 19.71 14.9062 18C14.9062 16.29 16.29 14.9062 18 14.9062C19.71 14.9062 21.0938 16.29 21.0938 18C21.0938 19.71 19.71 21.0938 18 21.0938ZM18 16.5938C17.2238 16.5938 16.5938 17.2238 16.5938 18C16.5938 18.7762 17.2238 19.4062 18 19.4062C18.7762 19.4062 19.4062 18.7762 19.4062 18C19.4062 17.2238 18.7762 16.5938 18 16.5938Z"
                fill="#ADB8CC"
              />
            </svg>
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2, overflow: "hidden" }}>
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            borderColor: soft,
            borderRadius: 2,
            maxHeight: 420,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{
              minWidth: 900,
              borderCollapse: "separate",
              "& thead th": {
                color: soft,
                fontWeight: 600,
                fontSize: 14,
                backgroundColor: "#fff",
                borderBottom: `1px solid ${soft}`,
                textAlign: "center",
                padding: "10px",
                whiteSpace: "nowrap",
              },
              "& tbody td": {
                padding: "10px",
                borderBottom: "none",
                color: soft,
                textAlign: "center",
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell
                  padding="checkbox"
                  sx={{
                    width: 52,
                    position: "sticky",
                    left: 0,
                    background: "#fff",
                    zIndex: 2,
                  }}
                />
                {columnDefs.map((c) => (
                  <TableCell key={c.api_name}>{c.label}</TableCell>
                ))}
              </TableRow>

              {showFilters && (
                <TableRow>
                  <TableCell
                    padding="checkbox"
                    sx={{
                      width: 52,
                      position: "sticky",
                      left: 0,
                      background: "#fff",
                      zIndex: 1,
                    }}
                  />
                  {columnDefs.map((c) => (
                    <TableCell key={c.api_name}>
                      <Paper
                        variant="outlined"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          px: 1,
                          py: 0.25,
                          borderRadius: 2,
                          borderColor: soft,
                        }}
                      >
                        <InputBase
                          placeholder={`Filter ${c.label}`}
                          value={colFilters[c.api_name] || ""}
                          onChange={(e) =>
                            setColFilters((s) => ({
                              ...s,
                              [c.api_name]: e.target.value,
                            }))
                          }
                          sx={{
                            width: "100%",
                            fontSize: 12,
                            color: soft,
                            "& input::placeholder": { color: soft, opacity: 1 },
                          }}
                        />
                      </Paper>
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableHead>

            <TableBody>
              {displayRows.map((row) => {
                const rid = row.id || row.ID || row._id;
                return (
                  <TableRow key={rid || JSON.stringify(row)} hover>
                    <TableCell
                      padding="checkbox"
                      sx={{
                        width: 52,
                        position: "sticky",
                        left: 0,
                        background: "#fff",
                        zIndex: 1,
                      }}
                    >
                      <Checkbox
                        checked={checkedId === rid}
                        onChange={() => toggleCheck(row)}
                        sx={{
                          color: soft,
                          "&.Mui-checked": { color: soft },
                          "& .MuiSvgIcon-root": { borderRadius: 4 },
                        }}
                      />
                    </TableCell>

                    {columnDefs.map((c) => (
                      <TableCell key={`${rid}-${c.api_name}`}>
                        {formatCell(row[c.api_name])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}

              {displayRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={1 + columnDefs.length}
                    align="center"
                    sx={{ color: soft, py: 4 }}
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => {
              setPage(p);
              setCheckedId(null);
            }}
            siblingCount={1}
            boundaryCount={1}
            sx={{
              "& .MuiPaginationItem-root": {
                color: soft,
                borderRadius: 1,
                minWidth: 25,
                height: 25,
              },
              "& .MuiPaginationItem-root.Mui-selected": {
                bgcolor: soft,
                color: "#fff",
              },
            }}
          />
        </Box>
      </DialogContent>

      <Popover
        open={columnsMenuOpen}
        anchorEl={columnsAnchorEl}
        onClose={() => setColumnsAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 1,
            maxHeight: 360,
            overflowY: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          },
        }}
      >
        <Box sx={{ px: 1, py: 0.5, color: soft, fontWeight: 600, fontSize: 14 }}>
          Choose columns
        </Box>
        {moduleFields.map((f) => {
          const active = visibleCols.includes(f.api_name);
          return (
            <MenuItem
              key={f.api_name}
              dense
              onClick={() => toggleFieldVisible(f.api_name)}
              sx={{ fontSize: 14, color: "#4C566A" }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {active ? <CheckIcon fontSize="small" /> : <span style={{ width: 16 }} />}
              </ListItemIcon>
              <ListItemText
                primaryTypographyProps={{ fontSize: 14 }}
                primary={f.label}
              />
            </MenuItem>
          );
        })}
      </Popover>
    </Dialog>
  );
}
