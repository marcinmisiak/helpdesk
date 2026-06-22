import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

function matchLdapLabel(ticket, labelCfg) {
  let extra = {};
  try { extra = ticket.ldap_data ? JSON.parse(ticket.ldap_data) : {}; } catch {}
  const val = labelCfg.condition_field === 'ldap_ou'
    ? ticket.ldap_ou
    : extra[labelCfg.condition_field];
  return val === labelCfg.condition_value;
}

function buildLdapLink(template, extra) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => extra[key] ?? '');
}

export default function LdapPanel({ ticket, onRefresh, ldapCardConfig, compact = false }) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try { await api.post(`/tickets/${ticket.id}/ldap-refresh`); onRefresh(); }
    catch { onRefresh(); }
    finally { setRefreshing(false); }
  };

  const ou = ticket.ldap_ou;
  if (ou === null || ou === undefined) return null;
  if (ldapCardConfig && !ldapCardConfig.ldap_card_enabled) return null;

  let extra = {};
  try { extra = ticket.ldap_data ? JSON.parse(ticket.ldap_data) : {}; } catch {}

  const notFound = ou === 'not_found';
  const labels = ldapCardConfig?.ldap_labels || [];
  const matched = labels.find(l => matchLdapLabel(ticket, l)) || null;

  const icon = matched?.icon || '👤';
  const labelText = matched?.label || (notFound ? t('ticket_view.ldap_not_found') : ou);
  const linkUrl = matched?.link_template ? buildLdapLink(matched.link_template, extra) : '';
  const linkText = matched?.link_label || t('ticket_view.ldap_open_link');

  const ldapAttrs = t('ticket_view.ldap_attrs', { returnObjects: true }) || {};
  const LDAP_ATTR_LABELS = {
    cn: 'CN', uid: 'UID',
    givenName: ldapAttrs.givenName, sn: ldapAttrs.sn,
    displayName: ldapAttrs.displayName, mail: ldapAttrs.mail,
    telephoneNumber: ldapAttrs.telephoneNumber, mobile: ldapAttrs.mobile,
    l: ldapAttrs.l, description: ldapAttrs.description,
    department: ldapAttrs.department, title: ldapAttrs.title,
    employeeType: ldapAttrs.employeeType, eduPersonAffiliation: ldapAttrs.eduPersonAffiliation,
    studid: ldapAttrs.studid, osobaid: ldapAttrs.osobaid, prow_id: ldapAttrs.prow_id,
  };

  const rows = Object.entries(LDAP_ATTR_LABELS)
    .map(([key, label]) => ({ key, label, val: extra[key] }))
    .filter(r => r.val);

  const cardColor = matched
    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    : notFound
      ? 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
      : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700';

  const badgeColor = matched
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-800/50 dark:text-blue-300'
    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  return (
    <div className={`mb-4 rounded-lg border text-sm ${cardColor}`}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-inherit">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{labelText}</span>
          {ticket.ldap_name && (
            <span className="font-semibold text-gray-800 dark:text-gray-100">{ticket.ldap_name}</span>
          )}
          {ticket.ldap_num && (() => {
            let albumNum = null;
            try { albumNum = ticket.ldap_data ? JSON.parse(ticket.ldap_data).uid : null; } catch {}
            const display = albumNum || ticket.ldap_num;
            const label = albumNum ? 'Numer albumu:' : 'ID:';
            return (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {label} <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{display}</span>
              </span>
            );
          })()}
          {linkUrl && (
            <a href={linkUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              {linkText}
            </a>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing} title={t('ticket_view.ldap_refresh')}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 text-base leading-none flex-shrink-0">
          {refreshing ? '⟳' : '↻'}
        </button>
      </div>
      {!compact && !notFound && rows.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 px-4 py-3 text-xs">
          {rows.map(({ key, label, val }) => (
            <div key={key}>
              <dt className="text-gray-400 dark:text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-700 dark:text-gray-200 break-words">{val}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
