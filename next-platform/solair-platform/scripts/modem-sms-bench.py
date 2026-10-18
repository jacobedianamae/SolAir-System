"""Gated A7670E USB SMS diagnostic. Does not flash ESP32 or enable automatic fallback.

First confirm the exact carrier's supply, SIM/SMS service, antenna and USB AT port.
Dry-run is the default. Credentials/recipient settings come from the environment.
"""
import argparse
import os
import re
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', help='Actual modem USB AT serial port; never the ESP console')
    parser.add_argument('--baud', type=int, default=115200)
    parser.add_argument('--execute-approved-test', action='store_true')
    args = parser.parse_args()
    if not args.execute_approved_test:
        print('DRY RUN: no port opened and no SMS sent. Read docs/OPERATIONAL_SETUP.md first.')
        return
    number = os.environ.get('SOLAIR_MODEM_RECIPIENT', '')
    allowed = os.environ.get('SOLAIR_SMS_TEST_RECIPIENTS', '').split(',')
    if os.environ.get('SOLAIR_MODEM_SMS_APPROVED') != '1' or not re.fullmatch(r'\+639\d{9}', number) or number not in allowed or not args.port:
        raise SystemExit('Blocked: explicit bench approval, approved recipient and actual USB AT port are required.')
    # pyserial is required only for the explicitly approved physical test.
    import serial
    with serial.Serial(args.port, args.baud, timeout=0.1, write_timeout=2) as modem:
        def command(text, expected=b'OK', timeout=5):
            modem.reset_input_buffer()
            modem.write(text.encode('ascii') + b'\r')
            result = bytearray()
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                result.extend(modem.read(256))
                if expected in result:
                    return bytes(result)
                if b'ERROR' in result:
                    raise RuntimeError('Modem rejected command; details withheld to protect contacts.')
                if len(result) > 4096:
                    raise RuntimeError('Modem response exceeded bound.')
            raise RuntimeError('Modem timed out. Do not blindly repeat a submission.')
        command('AT')
        if b'READY' not in command('AT+CPIN?'):
            raise RuntimeError('SIM is not ready.')
        registration = command('AT+CEREG?')
        if not re.search(rb'\+CEREG:\s*\d,\s*[15](?:\D|$)', registration):
            raise RuntimeError('Cellular registration not confirmed. No SMS submitted.')
        command('AT+CMGF=1')
        command('AT+CMGS="' + number + '"', b'>')
        modem.write(b'SOLAIR BENCH TEST. Approved recipient only. No physical alarm is asserted.\x1a')
        data = bytearray()
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            data.extend(modem.read(256))
            if b'+CMGS:' in data and b'OK' in data:
                print('MODEM ACCEPTED the test SMS. Handset receipt/delivery remains unverified; save independent evidence.')
                return
            if b'ERROR' in data:
                raise RuntimeError('Modem submission failed; no delivery claimed.')
        raise RuntimeError('Submission outcome UNKNOWN. Check the handset/operator before retrying.')


if __name__ == '__main__':
    main()
