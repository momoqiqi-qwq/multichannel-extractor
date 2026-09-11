use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ArchiveError {
    #[error("任务已取消")]
    Cancelled,
    #[error("需要密码")]
    PasswordRequired,
    #[error("密码错误")]
    InvalidPassword,
    #[error("不支持的压缩格式：{0}")]
    Unsupported(String),
    #[error("压缩包损坏或格式不兼容：{0}")]
    InvalidArchive(String),
    #[error("外部解压程序失败：{0}")]
    ExternalTool(String),
    #[error("路径无效：{0}")]
    InvalidPath(String),
    #[error("I/O 错误：{0}")]
    Io(#[from] io::Error),
}

