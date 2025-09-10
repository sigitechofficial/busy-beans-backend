const { account } = require('../models'); // adjust path to your models

function buildAddress({ address, city, state, zipCode, country }) {
  return [address, city, state, zipCode, country].filter(Boolean).join(', ');
}

function formatSupportNumber(code, number) {
  return [code, number].filter(Boolean).join(' ');
}

function generateFooterHtml({
  address = '',
  copyRight = 'Copyright &copy; 2025 Busy Bean Coffee, Inc.',
  supportEmail = '',
  supportNumber = '',
}) {
  return `
  <tr>
    <td style="padding-top:40px;font-family:'Switzer',sans-serif;font-weight:600;font-size:14px;text-align:center">
      Follow Us
    </td>
  </tr>
  <tr>
    <td style="padding-top:10px;text-align:center">
      <a href="https://www.facebook.com/busybeancoffeeinc/"
        style="display:inline-block;width:44px;height:44px;border-radius:50%;background-color:#8F5D46;margin-right:10px;text-align:center;line-height:44px;">
        <img src="cid:facebook" alt="Facebook" style="width:24px;height:24px;vertical-align:middle;" />
      </a>
      <a href="https://x.com/busybean_coffee"
        style="display:inline-block;width:44px;height:44px;border-radius:50%;background-color:#8F5D46;margin-right:10px;text-align:center;line-height:44px;">
        <img src="cid:twitter" alt="Twitter" style="width:24px;height:24px;vertical-align:middle;" />
      </a>
      <a href="https://www.instagram.com/busybean_coffee/"
        style="display:inline-block;width:44px;height:44px;border-radius:50%;background-color:#8F5D46;margin-right:10px;text-align:center;line-height:44px;">
        <img src="cid:instagram" alt="Instagram" style="width:24px;height:24px;vertical-align:middle;" />
      </a>
      <a href="https://www.linkedin.com/in/thecoffeeman/"
        style="display:inline-block;width:44px;height:44px;border-radius:50%;background-color:#8F5D46;margin-right:10px;text-align:center;line-height:44px;">
        <img src="cid:linkedin" alt="LinkedIn" style="width:24px;height:24px;vertical-align:middle;" />
      </a>
      <a href="https://www.youtube.com/channel/UC4b4PYax5H3jRSyw4r0MCjQ/featured"
        style="display:inline-block;width:44px;height:44px;border-radius:50%;background-color:#8F5D46;text-align:center;line-height:44px;">
        <img src="cid:youtube" alt="YouTube" style="width:26px;height:24px;vertical-align:middle;" />
      </a>
    </td>
  </tr>

  <tr>
    <td style="padding:20px 37px 0;font-family:'Switzer',sans-serif;font-size:13px;text-align:center;color:#000000;">
      ${address}
    </td>
  </tr>
  <tr>
    <td style="padding:10px 37px 0;font-family:'Switzer',sans-serif;font-size:13px;text-align:center;color:#000000;">
      ${supportEmail} ${supportNumber}
    </td>
  </tr>
  <tr>
    <td style="padding:10px 37px 0;font-family:'Switzer',sans-serif;font-size:13px;text-align:center;color:#000000;">
      ${copyRight}
    </td>
  </tr>

  <tr>
    <td style="padding-top:40px;font-family:'Work_Sans',sans-serif;font-size:14px;text-align:center;color:rgba(0,0,0,0.6);">
      Powered by
    </td>
  </tr>
  <tr>
    <td align="center" style="padding-top:20px">
      <a href="https://busybeancoffee.com" target="_blank" rel="noopener noreferrer">
        <img src="https://backendbb.trimworldwide.com/helper/images/logo.png" alt="Powered by" width="150" style="border-radius:16px;" />
      </a>
    </td>
  </tr>
  `;
}

async function footer() {
  const adm = await account.findOne({
    attributes: [
      'email',
      'supportEmail',
      'phoneNumber',
      'countryCode',
      'address',
      'city',
      'state',
      'zipCode',
      'country',
    ],
  });

  if (!adm) return generateFooterHtml({});

  const address = buildAddress(adm);
  const supportNumber = formatSupportNumber(adm.countryCode, adm.phoneNumber);

  return generateFooterHtml({
    address,
    supportEmail: adm.supportEmail || adm.email || '',
    supportNumber,
  });
}

module.exports = footer;
