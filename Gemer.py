import os
import sys
import json
import struct
import subprocess

# 在 Windows 平台下，必须将标准 I/O 强制切换至二进制模式，防止数据包长度头被系统篡改
if sys.platform == "win32":
    import msvcrt
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

def execute_command(cmd):
    """ 安全在本地执行系统控制台命令 """
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, timeout=20)
        output_bytes = res.stdout if res.returncode == 0 else (res.stderr if res.stderr else res.stdout)
        if not output_bytes:
            return "指令在后台执行，无返回数据。"
        for encoding in ('gbk', 'utf-8', 'utf-16', 'cp936'):
            try:
                return output_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue
        return output_bytes.decode('utf-8', errors='ignore')
    except Exception as e:
        return f"物理执行异常失败: {e}"

def read_message():
    """ 读取来自 Chrome 插件发来的消息数据包 """
    try:
        text_length_bytes = sys.stdin.buffer.read(4)
        if len(text_length_bytes) == 0:
            return None
        text_length = struct.unpack('i', text_length_bytes)[0]
        text = sys.stdin.buffer.read(text_length).decode('utf-8')
        return json.loads(text)
    except Exception:
        return None

def send_message(message_dict):
    """ 向 Chrome 插件发送结构化回执数据包 """
    try:
        message = json.dumps(message_dict).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('I', len(message)))
        sys.stdout.buffer.write(message)
        sys.stdout.buffer.flush()
    except Exception:
        pass

def main():
    while True:
        msg = read_message()
        if msg is None:
            break  # 当 Chrome 主动断开连接，read_message 返回空值，Python 进程安全自行销毁
        
        action = msg.get("action")
        if action == "status":
            send_message({"status": "running"})
        elif action == "execute":
            cmd = msg.get("cmd", "")
            output = execute_command(cmd)
            send_message({"status": "success", "output": output})

if __name__ == '__main__':
    main()