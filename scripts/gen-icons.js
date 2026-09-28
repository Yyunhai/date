const OFF = '#b0ada7';
const ON = '#5b6cff';

function svg(body, color, fillColor) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color +
    '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    body.replace(/@F/g, fillColor || 'none').replace(/@S/g, color) + '</svg>';
}

const shapes = {
  today: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5.4"/><circle cx="12" cy="12" r="3.6" fill="@F" stroke="@S"/>',
  money: '<circle cx="12" cy="12" r="8.6"/><path d="M8.7 7.9 12 11.6l3.3-3.7"/><path d="M12 11.6v4.7"/><path d="M9.4 13.4h5.2M9.4 15.5h5.2"/>',
  grid: '<rect x="3.6" y="3.6" width="7.3" height="7.3" rx="2.3" fill="@F" stroke="@S"/><rect x="13.1" y="3.6" width="7.3" height="7.3" rx="2.3" fill="@F" stroke="@S"/><rect x="3.6" y="13.1" width="7.3" height="7.3" rx="2.3" fill="@F" stroke="@S"/><rect x="13.1" y="13.1" width="7.3" height="7.3" rx="2.3" fill="@F" stroke="@S"/>'
};

const out = {};
Object.keys(shapes).forEach((key) => {
  out[key + 'Off'] = 'data:image/svg+xml;base64,' + Buffer.from(svg(shapes[key], OFF, 'none')).toString('base64');
  out[key + 'On'] = 'data:image/svg+xml;base64,' + Buffer.from(svg(shapes[key], ON, ON)).toString('base64');
});

console.log('module.exports = ' + JSON.stringify(out, null, 2) + ';\n');
