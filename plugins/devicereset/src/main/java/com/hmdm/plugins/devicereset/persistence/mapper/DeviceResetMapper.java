package com.hmdm.plugins.devicereset.persistence.mapper;

import com.hmdm.plugins.devicereset.persistence.domain.DeviceResetStatus;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface DeviceResetMapper {

    @Select("SELECT id, customerId, deviceId, factoryReset, reboot, lock, lockMessage, passwordReset " +
            "FROM plugin_devicereset_status WHERE deviceId = #{deviceId}")
    DeviceResetStatus findByDeviceId(@Param("deviceId") int deviceId);

    @Insert("INSERT INTO plugin_devicereset_status " +
            "(customerId, deviceId, factoryReset, reboot, lock, lockMessage, passwordReset) " +
            "VALUES (#{customerId}, #{deviceId}, #{factoryReset}, #{reboot}, #{lock}, #{lockMessage}, #{passwordReset})")
    int insertStatus(DeviceResetStatus status);

    @Update("UPDATE plugin_devicereset_status SET " +
            "factoryReset = #{factoryReset}, reboot = #{reboot}, lock = #{lock}, " +
            "lockMessage = #{lockMessage}, passwordReset = #{passwordReset} " +
            "WHERE deviceId = #{deviceId}")
    int updateStatus(DeviceResetStatus status);
}
