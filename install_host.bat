@echo off
title Gemer Native Host Setup
echo ===================================================
echo             Gemer 物理桥接一键初始化工具
echo ===================================================
echo.

:: 1. 创建并检测 Python 沙箱隔离环境
if not exist sys (
    echo [Environment] 未检测到本地 Python 隔离环境，正在自动构建，请稍候...
    python -m venv sys
    if errorlevel 1 (
        echo [ERROR] 虚拟机沙箱创建失败！请确保您的系统已安装 Python 并添加至系统 PATH。
        pause
        exit /b
    )
)

:: 2. 校验并升级依赖包
echo [Dependency] 正在校验依赖项并升级...
call sys\Scripts\activate.bat
python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

:: 3. 询问并获取 Chrome 扩展程序 ID 进行自动绑定
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

:: 利用 PowerShell 自动将 com.gemer.bridge.json 中的占位符替换为用户真实的扩展 ID
powershell -Command "(gc com.gemer.bridge.json) -replace '<EXTENSION_ID_REPLACE>', '%ext_id%' | Out-File -encoding utf8 com.gemer.bridge.json"

:: 4. 向 Windows 当前用户注册表写入配置，建立通道指向
echo [Registry] 正在向系统注册本地宿主控制凭证...
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gemer.bridge" /ve /t REG_SZ /d "%cd%\com.gemer.bridge.json" /f

echo.
echo ===================================================
echo             ?? 初始化配置已成功完成！
echo ===================================================
echo 现在您可以彻底关闭该文件夹了。
echo 未来只需打开浏览器，展开面板，本地 Python 即可全自动拉起与关闭。
echo.
pause