@echo off
title Gemer Native Host Setup
echo ===================================================
echo             Gemer 物理桥接一键自动部署工具
echo ===================================================
echo.

:: 1. 创建 sys 文件夹并自备部署绿色版 Python 3.11（优先使用华为云国内高倍速镜像）
if not exist sys (
    mkdir sys
)

if not exist sys\python.exe (
    echo [Environment] 正在极速自备部署免安装绿色版 Python 3.11...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://repo.huaweicloud.com/python/3.11.9/python-3.11.9-embed-amd64.zip' -OutFile 'python_embed.zip' -TimeoutSec 15 } catch { echo '[提示] 镜像源请求受限，正在回退至官方备用源...'; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip' -OutFile 'python_embed.zip' }"
    
    echo [Environment] 正在解压 Python 运行环境至 sys 文件夹...
    powershell -Command "Expand-Archive -Path 'python_embed.zip' -DestinationPath 'sys' -Force"
    del python_embed.zip
)

:: 2. 配置 Python 寻址路径文件，激活第三方库导入支持
if exist sys\python311._pth (
    echo [Environment] 正在配置 Python 寻址环境...
    (
    echo python311.zip
    echo .
    echo Lib\site-packages
    echo import site
    ) > sys\python311._pth
)

:: 3. 部署依赖包管理器 pip（优先使用国内 Gitee 极速镜像）
if not exist sys\Scripts\pip.exe (
    echo [Dependency] 正在自动部署包管理器组件...
    powershell -Command "try { Invoke-WebRequest -Uri 'https://gitee.com/mirrors_pypa/get-pip/raw/master/public/get-pip.py' -OutFile 'get-pip.py' -TimeoutSec 15 } catch { echo '[提示] 国内节点拥堵，正在尝试回退至官方备用源...'; Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'get-pip.py' }"
    sys\python.exe get-pip.py --no-warn-script-location
    del get-pip.py
)

:: 4. 自动安装库依赖（全面使用国内清华大学镜像源加速）
echo [Dependency] 正在安装库依赖...
sys\python.exe -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

:: 5. 绑定扩展程序并写入注册表
echo.
echo ===================================================
echo 绑定提示:
echo 1. 请打开谷歌浏览器，访问 chrome://extensions/ 
echo 2. 装载您的 gemer_extension 文件夹
echo 3. 复制页面上显示的 "ID" (例如: knldjmfmopnpolahpmmgbagdohdnhkik)
echo ===================================================
echo.
set /p ext_id="请输入上面复制的扩展程序 ID (复制后在此右键粘贴并回车): "

if "%ext_id%"=="" (
    echo [ERROR] 扩展程序 ID 不能为空！
    pause
    exit /b
)

:: 替换占位符
powershell -Command "(gc com.gemer.bridge.json) -replace '<EXTENSION_ID_REPLACE>', '%ext_id%' | Out-File -encoding utf8 com.gemer.bridge.json"

:: 写入注册表，建立连接关联
echo [Registry] 正在向系统注册本地通道凭证...
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gemer.bridge" /ve /t REG_SZ /d "%cd%\com.gemer.bridge.json" /f

echo.
echo ===================================================
echo             ?? 初始化配置已成功完成！
echo ===================================================
echo 现在您可以彻底关闭该文件夹了。
echo 未来只需打开浏览器，展开面板，本地 Python 即可全自动拉起与关闭。
echo.
pause