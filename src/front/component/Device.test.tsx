import {render, screen} from '@testing-library/react';
import {test, expect} from 'vitest';
import Device from './Device';

/**
 * With testing-library/react, vitest and electron,
 * it's really hard to configure front testing environments.
 * Also, it seems not necessary to test front side right now.
 * TODO Decide what to do next.
 */

test('Render Device', () => {
  const device = {
    id: '1234',
    ip: '1.2.3.4',
    os: 'linux',
    version: '0.5.2',
  };
  render(
    <Device
      device={device}
      isSelected={false}
      setSelectedIp={() => {}}
    />
  );
  const component = screen.getByText(device.id);
  expect(component).not.toBeNull();
});
