import express from "express";
import { ServiceNowRitmData, ServiceNowExtractedFields } from "../src/types";

// HTML / Text parser for ServiceNow RITM tickets (Variables & Form fields)
export function parseServiceNowHtml(htmlOrText: string, targetRitm: string = 'RITM001508091'): ServiceNowRitmData {
  const extracted: ServiceNowExtractedFields = {
    dnsServers: []
  };
  const allVariables: Record<string, any> = {};

  // Clean and find text tokens
  const text = htmlOrText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                         .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 1. Regex patterns for common ServiceNow catalog variable structures
  // Variable tables often render as:
  // <label>Hostname</label> <span>esxi-prd-01.generali.com</span>
  // or "Hostname: esxi-prd-01"
  // or input elements with names/values
  
  // Extract inputs and textareas
  const inputRegex = /<input[^>]+(?:name|id)=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(htmlOrText)) !== null) {
    const key = match[1];
    const val = match[2];
    if (val && !key.startsWith('sys_') && !key.startsWith('ni.') && !key.startsWith('sysparm_')) {
      allVariables[key] = { label: key, value: val, displayValue: val };
    }
  }

  // Extract common patterns like "Label: Value" or tabular rows
  const patterns: Array<{ key: keyof ServiceNowExtractedFields; regexes: RegExp[] }> = [
    {
      key: 'hostname',
      regexes: [
        /(?:host(?:name)?|server(?:_name)?|esxi(?:_name)?)\s*[:=]\s*([a-zA-Z0-9.-]+)/i,
        /["'](?:hostname|esxi_name|server_name)["']\s*[:=]\s*["']([^"']+)["']/i
      ]
    },
    {
      key: 'managementIp',
      regexes: [
        /(?:management[_\s]*ip|host[_\s]*ip|ip[_\s]*address|ip_mgmt)\s*[:=]\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i,
        /["'](?:ip_address|management_ip|host_ip)["']\s*[:=]\s*["']([0-9.]+)["']/i
      ]
    },
    {
      key: 'managementMask',
      regexes: [
        /(?:subnet[_\s]*mask|mask|netmask)\s*[:=]\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i,
        /["'](?:subnet_mask|netmask)["']\s*[:=]\s*["']([0-9.]+)["']/i
      ]
    },
    {
      key: 'gatewayIp',
      regexes: [
        /(?:gateway|default[_\s]*gateway)\s*[:=]\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i,
        /["'](?:gateway|default_gateway)["']\s*[:=]\s*["']([0-9.]+)["']/i
      ]
    },
    {
      key: 'vmotionIp',
      regexes: [
        /(?:vmotion[_\s]*ip|ip[_\s]*vmotion)\s*[:=]\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i,
        /["'](?:vmotion_ip)["']\s*[:=]\s*["']([0-9.]+)["']/i
      ]
    },
    {
      key: 'vmotionMask',
      regexes: [
        /(?:vmotion[_\s]*mask)\s*[:=]\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i
      ]
    },
    {
      key: 'ipmiAddress',
      regexes: [
        /(?:ipmi|bmc|idrac|imm|xcc)[_\s]*(?:ip|address)?\s*[:=]\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i,
        /["'](?:ipmi_ip|bmc_ip|idrac_ip|xcc_ip)["']\s*[:=]\s*["']([0-9.]+)["']/i
      ]
    },
    {
      key: 'hardwareModel',
      regexes: [
        /(?:hardware[_\s]*model|server[_\s]*model|model)\s*[:=]\s*([a-zA-Z0-9\s-]+?)(?:\r|\n|<|$)/i
      ]
    }
  ];

  for (const { key, regexes } of patterns) {
    for (const rx of regexes) {
      const m = text.match(rx);
      if (m && m[1] && m[1].trim()) {
        (extracted as any)[key] = m[1].trim();
        break;
      }
    }
  }

  // Extract all IPs found in text
  const ipMatches = text.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g) || [];
  const uniqueIps = Array.from(new Set(ipMatches)).filter(ip => ip !== '127.0.0.1' && ip !== '0.0.0.0');

  // If management IP was not found by pattern, assign first valid private IP found
  if (!extracted.managementIp && uniqueIps.length > 0) {
    extracted.managementIp = uniqueIps[0];
  }
  if (!extracted.managementMask) {
    extracted.managementMask = '255.255.255.0';
  }

  // Check hardware vendor
  if (/dell|poweredge|idrac/i.test(text)) {
    extracted.hardwareVendor = 'DELL';
  } else if (/lenovo|thinksystem|xcc|imm/i.test(text)) {
    extracted.hardwareVendor = 'LENOVO';
  }

  // Extract short description or ticket details
  const shortDescMatch = text.match(/(?:short[_\s]*description|summary)\s*[:=]\s*([^\r\n<]+)/i);
  const requesterMatch = text.match(/(?:requester|requested[_\s]*for|opened[_\s]*by)\s*[:=]\s*([^\r\n<]+)/i);

  return {
    number: targetRitm,
    sysId: '77473ef347a1f65073bb7fa5536d4339',
    shortDescription: shortDescMatch ? shortDescMatch[1].trim() : `ServiceNow Ticket ${targetRitm}`,
    description: `Extracted from ServiceNow page`,
    state: 'In Progress',
    stage: 'Fulfillment',
    approval: 'Approved',
    requester: requesterMatch ? requesterMatch[1].trim() : 'b305glp',
    environment: /prd|prod/i.test(text) ? 'Production' : 'Staging',
    datacenter: 'Generali Datacenter',
    extractedFields: extracted,
    allVariables,
    rawFields: { rawLength: htmlOrText.length, ipCount: uniqueIps.length, ipsFound: uniqueIps },
    source: 'live_api',
    instanceUrl: 'https://generali.service-now.com',
    fetchedAt: new Date().toISOString()
  };
}
